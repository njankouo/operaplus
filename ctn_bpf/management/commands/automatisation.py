from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from ctn_bpf.models import Operation


class Command(BaseCommand):
    help = "Envoie des alertes pour les tâches qui expirent bientôt"

    def handle(self, *args, **options):
        maintenant = timezone.now()
        taches = Operation.objects.filter(
            date_echeance__gte=maintenant,
            etat=0
        )

        for tache in taches:
            self.stdout.write(f"Vérification de : {tache.nom}")

            sujet = f"⏰ Alerte échéance – {tache.nom}"

            message = f"""
Bonjour,

La tâche suivante arrive à échéance :

Nom : {tache.nom}
Date d'échéance : {tache.date_echeance.strftime('%d/%m/%Y %H:%M')}

Merci de prendre les mesures nécessaires.

Cordialement,
Système CTN BPF
            """

            try:
                send_mail(
                    subject=sujet,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[tache.personnel.mail], 
                    fail_silently=False,
                )

                self.stdout.write(
                    self.style.SUCCESS(f"Email envoyé pour : {tache.nom}")
                )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Erreur email ({tache.nom}) : {e}")
                )

        self.stdout.write(self.style.SUCCESS("Automatisation terminée !"))
