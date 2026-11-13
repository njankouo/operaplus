"""python manage.py archivage_initialiser [--verifier] [--purger]

- crée la fiche (cote, empreinte SHA-256, texte) des documents déjà présents ;
- --verifier : contrôle l'intégrité de tous les fichiers ;
- --purger   : élimine les documents restés en corbeille plus de ARCHIVAGE_CORBEILLE_JOURS (30) jours.
À planifier chaque nuit (cron) avec --verifier --purger.
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from archive.utils import journaliser, modele_archive, synchroniser_fiche
from archive.models import ArchiveFiche


class Command(BaseCommand):
    help = "Inventorie les archives existantes, contrôle l'intégrité et purge la corbeille."

    def add_arguments(self, p):
        p.add_argument('--verifier', action='store_true')
        p.add_argument('--purger', action='store_true')

    def handle(self, *args, **o):
        from archive.views import _verifier
        A = modele_archive()
        deja = set(ArchiveFiche.objects.values_list('archive_id', flat=True))
        n = 0
        for a in A.objects.exclude(pk__in=list(deja)).iterator():
            synchroniser_fiche(a)
            n += 1
        self.stdout.write(self.style.SUCCESS('%d document(s) inventorié(s).' % n))
        if o['verifier']:
            ok = ko = 0
            for f in ArchiveFiche.objects.filter(supprime_le__isnull=True):
                a = A.objects.filter(pk=f.archive_id).first()
                if a is None:
                    continue
                if _verifier(a, f)[0]:
                    ok += 1
                else:
                    ko += 1
                    self.stdout.write(self.style.ERROR('ALTÉRÉ / MANQUANT : %s (%s)' % (f.cote, getattr(a, 'titre', ''))))
            self.stdout.write('Intégrité : %d intact(s), %d problème(s).' % (ok, ko))
        if o['purger']:
            from archive.views import _eliminer
            limite = timezone.now() - timedelta(days=int(getattr(settings, 'ARCHIVAGE_CORBEILLE_JOURS', 30)))
            p = 0
            for f in ArchiveFiche.objects.filter(supprime_le__lt=limite, gel_juridique=False):
                a = A.objects.filter(pk=f.archive_id).first()
                if a is not None and _eliminer(None, a, f, 'Purge automatique de la corbeille'):
                    p += 1
            self.stdout.write('Corbeille : %d document(s) éliminé(s).' % p)
