"""Signaux : chaque archive créée/supprimée par VOS vues reçoit sa fiche / sa trace au journal."""
from .models import ArchiveFiche

def _apres_enregistrement(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    from .utils import modele_archive, synchroniser_fiche
    try:
        if sender is not modele_archive():
            return
    except LookupError:
        return
    synchroniser_fiche(instance, creation=created)


def _apres_suppression(sender, instance, **kwargs):
    from .utils import journaliser, modele_archive
    try:
        if sender is not modele_archive():
            return
    except LookupError:
        return
    if getattr(instance, '_ar_elimine', False):
        return
    fiche = ArchiveFiche.objects.filter(archive_id=instance.pk).first()
    journaliser('suppression_externe', archive_id=instance.pk, fiche=fiche, titre=getattr(instance, 'titre', ''),
                details={'sha256': fiche.sha256 if fiche else ''})
    if fiche:
        fiche.delete()


def connecter():
    from django.db.models.signals import post_delete, post_save
    post_save.connect(_apres_enregistrement, dispatch_uid='archive_post_save')
    post_delete.connect(_apres_suppression, dispatch_uid='archive_post_delete')
