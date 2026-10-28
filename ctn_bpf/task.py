from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
import datetime
from datetime import date, datetime, time
from datetime import timedelta
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.core import mail
from .models import Operation, DSet_DElt, PeriodeOk, DataElement, Institution, FinancementOperation, SourceFinancement
from django.db.models import Sum, Max, Min, Avg, FloatField
from django.db.models.functions import Cast
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
@shared_task
def send_expert_registration_email(expert_data):
   
    try:
        fullname = expert_data.get('fullname', 'Inconnu')
        country = expert_data.get('country', 'Non spécifié')
        recipient_email = expert_data.get('email')  # <-- Récupère l'email du formulaire

        if not recipient_email:
            print("--- AUCUN EMAIL FOURNI ---")
            return

        subject = f"Bienvenue {fullname} !"
        message = (
            f"Bonjour {fullname},\n\n"
            f"Merci pour votre inscription en tant qu'expert MEAL.\n"
            f"Pays : {country}\n\n"
            f"Cordialement,\nL'équipe MEAL"
        )

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,  # Ton email d'expéditeur
            [recipient_email],  # Envoie à l'utilisateur qui a rempli le formulaire
            fail_silently=False,
        )
        print(f"--- MAIL ENVOYÉ AVEC SUCCÈS À {recipient_email} ---")

    except Exception as e:
        print(f"--- ERREUR DANS LA TÂCHE : {str(e)} ---")



@shared_task
def send_operation_mail(operation_id):
    try:
        # On utilise select_related pour charger la tâche et éviter les requêtes inutiles
        operation = Operation.objects.select_related('tache').get(id=operation_id)
        
        # Sécurisation de l'institution
        inst = operation.institution()
        inst_name = inst.operations_name() if inst else "Opération"
        
        subject = f"Attribution - {operation.nom}"
        email_from = settings.EMAIL_HOST_USER
        
        raci_roles = [
            (operation.personnel, 'Responsable'),
            (operation.accountable, 'A'),
            (operation.consulted, 'C'),
            (operation.informed, 'I')
        ]

        for person, role_code in raci_roles:
            if person and person.mail:
                # On passe des objets sécurisés au template
                context = {
                    'operation': operation,
                    'personnel': person,
                    'tache': operation.tache,
                    'institution': inst, # Peut être None, mais le template doit le gérer
                    'inst_name': inst_name,
                    'role': role_code
                }
                
                try:
                    message_html = render_to_string('webpages/ctn_bpf/mails/new_operation.html', context)
                    email = EmailMessage(subject, message_html, email_from, [person.mail])
                    email.content_subtype = 'html'
                    
                    if operation.fichier_joint:
                        email.attach(operation.fichier_joint.name, operation.fichier_joint.read())
                    
                    email.send(fail_silently=True)
                except Exception as e:
                    print(f"Erreur lors de l'envoi à {person.mail}: {e}")

    except Operation.DoesNotExist:
        print(f"Erreur: L'opération {operation_id} n'existe pas en base.")
    except Exception as e:
        print(f"Erreur critique dans la tâche Celery: {e}")

@shared_task
def check_overdue_tasks():
    maintenant = timezone.now()
    
    # 1. Filtre SQL optimisé (on ne prend que ce qui n'est pas déjà notifié)
    overdue_tasks = Operation.objects.filter(
        etat="0", # Utilise "0" si c'est un CharField comme vu en SQL
       
        m_institution__alert_retard_active=True,
        date_echeance__lte=maintenant.date() # On ne récupère que ce qui est déjà échu
    ).exclude(personnel__isnull=True).select_related('personnel', 'm_institution')

    if not overdue_tasks.exists():
        return

    # 2. On ouvre UNE SEULE connexion pour tout le groupe
    connection = mail.get_connection()
    messages = []
    tasks_to_update = []

    for task in overdue_tasks:
        try:
            inst_obj = task.m_institution
            echeance = task.date_echeance
            
            # Conversion en datetime aware
            if isinstance(echeance, date) and not isinstance(echeance, datetime):
                echeance_dt = timezone.make_aware(datetime.combine(echeance, time.min))
            else:
                echeance_dt = echeance

            seuil_alerte = echeance_dt + timedelta(minutes=inst_obj.minutes_avant_alerte)

            if maintenant >= seuil_alerte:
                # Création du message sans l'envoyer immédiatement
                email = mail.EmailMessage(
                    subject=f"⚠️ Retard : {task.nom}",
                    body=f"Bonjour, la tâche '{task.nom}' est en retard. Échéance : {task.date_echeance}.",
                    from_email="beininfoplus@operaplus.org",
                    to=[task.personnel.mail],
                )
                messages.append(email)
                tasks_to_update.append(task)

        except Exception as e:
            print(f"Erreur préparation tâche {task.id}: {str(e)}")

    # 3. Envoi groupé et mise à jour
    if messages:
        try:
            connection.open()
            connection.send_messages(messages)
            connection.close()
            
            # Mise à jour massive des notifications pour éviter de boucler
            ids_notified = [t.id for t in tasks_to_update]
            Operation.objects.filter(id__in=ids_notified).update(is_notified=True)
            
            print(f"{len(messages)} mails de retard envoyés.")
        except Exception as e:
            print(f" Erreur lors de l'envoi SMTP: {str(e)}")





import logging
from django.db import transaction
from django.db.models import Sum, Max, Min, Avg, FloatField
from django.db.models.functions import Cast
from django.utils import timezone
from celery import shared_task

logger = logging.getLogger(__name__)

@shared_task(bind=True)
def trigger_analytics_calculation(self, data_element_id, structure_id, periode_id):
    try:
        with transaction.atomic():
            # 1. Objets de base
            source_de = DataElement.objects.get(id=data_element_id)
            if not source_de.is_calcul:
                return "SKIP : Calcul désactivé"

            target_de = DataElement.objects.filter(parent=source_de, define=True).first()
            if not target_de:
                return "INFO : Pas de cible enfant"

            periode_actuelle = PeriodeOk.objects.get(id=periode_id)

            # 2. 🔥 DÉTECTION DU MOIS LE PLUS GRAND
            # On vérifie quel est le numero_ordre le plus élevé importé pour ce parent/structure
            max_ordre = DSet_DElt.objects.filter(
                m_dataelement=source_de,
                m_structure_id=structure_id
            ).aggregate(max_o=Max('periode__numero_ordre'))['max_o']

            # Si la période de la tâche en cours n'est pas la plus grande, on arrête !
            if periode_actuelle.numero_ordre < max_ordre:
                return f"IGNORE : {periode_actuelle.nom} n'est pas le mois le plus récent (Max: {max_ordre})"

            # 3. CALCUL GLOBAL (Seulement pour le mois le plus grand)
            # On prend tout depuis la borne de début jusqu'au mois max
            queryset = DSet_DElt.objects.filter(
                m_dataelement=source_de,
                m_structure_id=structure_id,
                periode__numero_ordre__gte=target_de.periode_debut.numero_ordre,
                periode__numero_ordre__lte=periode_actuelle.numero_ordre
            )

            calc_type = target_de.m_aggregation_type
            if calc_type == 's':
                total = queryset.aggregate(res=Sum('m_value'))['res'] or 0
            elif calc_type == 'a':
                total = queryset.aggregate(res=Avg('m_value'))['res'] or 0
            # ... (Ajouter M et m si besoin)
            else:
                total = queryset.aggregate(res=Sum('m_value'))['res'] or 0

            # 4. ENREGISTREMENT UNIQUE (Le fameux 539)
            DSet_DElt.objects.update_or_create(
                m_dataelement=target_de,
                periode=periode_actuelle,
                m_structure_id=structure_id,
                defaults={
                    'm_value': int(total),
                    'date_saisie': timezone.now().date(),
                    'comment': f"Total cumulé final arrêté au mois de {periode_actuelle.nom}"
                }
            )

            return f"SUCCÈS : Seul le mois {periode_actuelle.nom} (Max) a été enregistré. Valeur : {total}"

    except Exception as e:
        logger.error(f"Erreur : {str(e)}")
        raise e



@shared_task
def async_register_sources_financement(operation_id, institution_id, financements_data):
    """
    Tâche asynchrone traitée via Redis.
    financements_data est un dictionnaire { 'source_id': 'montant' }
    """
    try:
        operation = Operation.objects.get(id=operation_id)
        institution = Institution.objects.get(id=institution_id)
        
        with transaction.atomic():
            for s_id, montant_str in financements_data.items():
                try:
                    source = SourceFinancement.objects.get(id=int(s_id))
                    
                    # Nettoyage du montant
                    montant_clean = str(montant_str).replace(' ', '').replace(',', '.')
                    montant_decimal = Decimal(montant_clean) if montant_clean else Decimal('0')

                    FinancementOperation.objects.create(
                        operation=operation,
                        source_financement=source,
                        montant_attribue=montant_decimal,
                        institution=institution
                    )
                except (SourceFinancement.DoesNotExist, InvalidOperation):
                    continue
                    
        return f"Financements enregistrés pour l'opération {operation_id}"
    
    except Operation.DoesNotExist:
        return "Erreur : Opération introuvable"
