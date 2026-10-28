from celery import shared_task
from django.core.mail import send_mail

from django.utils import timezone
import datetime
from datetime import date, datetime, time
from datetime import timedelta
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.core import mail
from .models import Operation, DSet_DElt, PeriodeOk, DataElement, Institution, FinancementOperation, SourceFinancement, Periode, PeriodeOk, Structure
from django.db.models import Sum, Max, Min, Avg, FloatField
from django.db.models.functions import Cast
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
import pandas as pd
from django.conf import settings

import logging
from django.db import transaction
from django.db.models import Sum, Max, Min, Avg, FloatField
from django.db.models.functions import Cast
from django.utils import timezone
from celery import shared_task

import os
import shutil
from datetime import datetime
from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)
@shared_task
def send_expert_registration_email(expert_data):
    try:
        fullname = expert_data.get('fullname', 'Inconnu')
        country = expert_data.get('country', 'Non spécifié')
        recipient_email = expert_data.get('email')  
        
        # CORRECTION : On récupère le mot de passe depuis le dictionnaire reçu
        password = expert_data.get('password')

        if not recipient_email:
            print("--- AUCUN EMAIL FOURNI ---")
            return

        subject = f"Bienvenue sur la plateforme MEAL, {fullname} !"
        
        # Utilisation de formatage moderne pour plus de lisibilité
        message = (
            f"Bonjour {fullname},\n\n"
            f"Votre compte expert a été créé avec succès.\n"
            f"Pays associé : {country}\n\n"
            f"Vos identifiants :\n"
            f"Email : {recipient_email}\n"
            f"Mot de passe : {password}\n\n"
            f"Cordialement,\nL'équipe technique"
        )

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
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

@shared_task(bind=True)
def trigger_analytics_calculation(self, data_element_id, structure_id, periode_id):
    try:
        with transaction.atomic():
            # 1. RÉCUPÉRATION
            source_de = DataElement.objects.get(id=data_element_id)
            target_de = DataElement.objects.filter(parent=source_de, define=True).first()
            
            if not target_de:
                return "ANNULATION : Pas de cible définie."

            structure = Structure.objects.get(id=structure_id)
            p_saisie = PeriodeOk.objects.get(id=periode_id)

            # 2. VERROU DE PÉRIODICITÉ
            # On récupère la périodicité voulue par le fils (ex: 'Mensuel')
            periodicite_cible = target_de.periode_debut.periodicite

            # SI LA PÉRIODE SAISIE EST JOURNALIÈRE MAIS QUE LE PROJET EST MENSUEL -> ON ARRÊTE
            if p_saisie.periodicite != periodicite_cible:
                return f"IGNORÉ : La période {p_saisie.nom} est '{p_saisie.periodicite}', mais le calcul attend '{periodicite_cible}'."

            # 3. PLAGE DU PROJET
            ordre_debut = target_de.periode_debut.numero_ordre
            ordre_fin = target_de.periode_fin.numero_ordre

            # 4. SÉLECTION DES PÉRIODES (Uniquement du type attendu)
            periodes_du_projet = PeriodeOk.objects.filter(
                periodicite=periodicite_cible,
                numero_ordre__gte=ordre_debut,
                numero_ordre__lte=ordre_fin 
            ).order_by('numero_ordre')

            for p in periodes_du_projet:
                # 5. CUMUL STRICT
                # On ne somme QUE les lignes de la même périodicité (ex: mensuel + mensuel)
                # Cela exclut les "Dimanches" de ton calcul "Mensuel"
                queryset = DSet_DElt.objects.filter(
                    m_dataelement=source_de,
                    m_structure_id=structure_id,
                    periode__periodicite=periodicite_cible,
                    periode__numero_ordre__gte=ordre_debut,
                    periode__numero_ordre__lte=p.numero_ordre
                )

                # 6. CALCUL
                calc_type = target_de.m_aggregation_type
                res = queryset.aggregate(
                    res=Sum('m_value') if calc_type != 'a' else Avg('m_value')
                )['res']
                
                total = round(float(res or 0), 1)

                # 7. NETTOYAGE ET ENREGISTREMENT
                search_params = {
                    'm_dataelement': target_de,
                    'periode': p,
                    'm_structure_id': structure_id,
                }
                DSet_DElt.objects.filter(**search_params).delete()
                DSet_DElt.objects.create(
                    **search_params,
                    m_value=total,
                    date_saisie=timezone.now().date(),
                    comment=f"Cumul {periodicite_cible} auto"
                )
                
            return f"Calcul {periodicite_cible} terminé pour {structure.nom}."

    except Exception as e:
        print(f"ERREUR : {str(e)}")
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



@shared_task
def import_data_to_database(file_path, update_mode=False, dry_run=False):
    created, updated, skipped = 0, 0, 0
    to_create, to_update = [], []
    errors = []

    # 1. Setup Cache
    periodicites_cache = {p.m_value.lower(): p for p in Periode.objects.all()}
    
    # 2. Pre-fetch existing records
    existing_records = {
        (p.annee, p.numero_ordre, p.periodicite_id): p 
        for p in PeriodeOk.objects.all().only('id', 'annee', 'numero_ordre', 'periodicite_id', 'nom', 'date_debut', 'date_fin')
    }

    try:
        df = pd.read_excel(file_path)
        
        # Optionnel: Convertir les colonnes en datetime si pandas ne le fait pas automatiquement
        if 'date_debut' in df.columns:
            df['date_debut'] = pd.to_datetime(df['date_debut']).dt.date
        if 'date_fin' in df.columns:
            df['date_fin'] = pd.to_datetime(df['date_fin']).dt.date

        with transaction.atomic():
            for index, row in enumerate(df.to_dict(orient='records')):
                try:
                    p_type_raw = str(row.get("period_type", "")).strip().lower()
                    periodicite = periodicites_cache.get(p_type_raw)

                    if not periodicite:
                        errors.append(f"Ligne {index+2}: type '{p_type_raw}' inconnu")
                        continue

                    key = (row["annee"], row.get("numero_ordre", 1), periodicite.id)
                    period = existing_records.get(key)

                    if period:
                        if update_mode:
                            # Mise à jour des champs
                            period.nom = str(row["nom"])
                            period.date_debut = row.get("date_debut") # Mise à jour date_debut
                            period.date_fin = row.get("date_fin")     # Mise à jour date_fin
                            
                            to_update.append(period)
                            updated += 1
                        else:
                            skipped += 1
                    else:
                        # Création avec les nouvelles colonnes
                        to_create.append(PeriodeOk(
                            nom=row["nom"],
                            annee=row["annee"],
                            periodicite=periodicite,
                            numero_ordre=row.get("numero_ordre", 1),
                            date_debut=row.get("date_debut"), # Ajout date_debut
                            date_fin=row.get("date_fin")      # Ajout date_fin
                        ))
                        created += 1

                    # Batch Insert
                    if len(to_create) >= 1000:
                        PeriodeOk.objects.bulk_create(to_create)
                        to_create = []

                except Exception as e:
                    errors.append(f"Ligne {index+2}: {str(e)}")

            # Finalize
            if not dry_run:
                if to_create: 
                    PeriodeOk.objects.bulk_create(to_create)
                if to_update: 
                    # Ajout de date_debut et date_fin dans la liste des champs à mettre à jour
                    PeriodeOk.objects.bulk_update(to_update, ['nom', 'date_debut', 'date_fin'])
            else:
                raise Exception("Rollback_Simulation")

    except Exception as e:
        if "Rollback_Simulation" not in str(e):
            return {"status": "error", "message": str(e)}

    return {"status": "success", "created": created, "updated": updated, "errors": errors[:100]}



@shared_task
def backup_models_and_data():
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    backup_dir = os.path.join(settings.BASE_DIR, 'backups', timestamp.replace(':', '').replace(' ', '_'))
    
    # Variables pour le rapport (stats)
    status = "SUCCÈS"
    details = []
    
    try:
        os.makedirs(backup_dir, exist_ok=True)
        
        # 1. Dump BDD
        path_json = os.path.join(backup_dir, 'db.json')
        with open(path_json, 'w', encoding='utf-8') as f:
            call_command('dumpdata', stdout=f)
        details.append(f"✅ Base de données sauvegardée : {path_json}")

        # 2. Copie models.py
        app_name = 'ctn_bpf'
        models_path = os.path.join(settings.BASE_DIR, app_name, 'models.py')
        if os.path.exists(models_path):
            shutil.copy2(models_path, os.path.join(backup_dir, 'models.py'))
            details.append("✅ Fichier models.py copié avec succès.")
        else:
            details.append("⚠️ Attention : models.py introuvable.")

    except Exception as e:
        status = "ÉCHEC"
        details.append(f"❌ Erreur critique : {str(e)}")

    # 3. Préparation et envoi de l'email
    sujet = f"[{status}] Rapport de Sauvegarde Automatique - {timestamp}"
    message = f"Rapport généré le {timestamp}\n\nStatut global : {status}\n\nActions effectuées :\n"
    message += "\n".join(details)
    message += f"\n\nEmplacement : {backup_dir}"

    send_mail(
        sujet,
        message,
        settings.EMAIL_HOST_USER,
        ['dairounjankouo2019@gmail.com'],
        fail_silently=False,
    )

    return f"Rapport envoyé pour le backup dans {backup_dir}"

# 1. Déclaration de la tâche Celery
@shared_task
def send_notifications(nom_client, email, telephone, package_nom, duree, montant_final):
    """
    Tâche asynchrone Celery pour l'envoi d'emails.
    On passe directement les chaînes de caractères pour éviter les accès BD inutiles.
    """
    try:
        subject = f"Nouvel abonnement : {nom_client}"
        message = (
            f"Un nouvel abonnement a été soumis.\n\n"
            f"Client : {nom_client}\n"
            f"Email : {email}\n"
            f"Téléphone : {telephone}\n"
            f"Package : {package_nom}\n"
            f"Durée : {duree} mois\n"
            f"Montant : {montant_final} FCFA\n\n"
            f"Veuillez vérifier le paiement dans l'interface admin."
        )
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            ['dairounjankouo2019@gmail.com', 'henockmfouapon3@gmail.com'],
            fail_silently=False,
        )
    except Exception as e:
        print(f"Erreur envoi email (non bloquante) : {e}")