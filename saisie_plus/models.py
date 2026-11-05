from django.conf import settings
from django.db import models


class JournalSaisie(models.Model):
    """Une ligne par enregistrement réussi d'un formulaire (qui, quand, combien de valeurs)."""
    dataset_id = models.IntegerField('formulaire', db_index=True)
    structure_id = models.IntegerField('unité', db_index=True)
    periode = models.CharField('période', max_length=64, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='saisi par')
    nb_valeurs = models.PositiveIntegerField('valeurs envoyées', default=0)
    nb_modifiees = models.PositiveIntegerField('valeurs modifiées', default=0)
    date = models.DateTimeField('date', auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'saisie enregistrée'
        verbose_name_plural = 'journal des saisies'

    def __str__(self):
        return f'Formulaire {self.dataset_id} · unité {self.structure_id} · {self.periode} · {self.date:%d/%m/%Y %H:%M}'


class Justification(models.Model):
    """Explication donnée par l'agent pour une valeur inhabituelle (une par élément, unité et période)."""
    dataset_id = models.IntegerField('formulaire', db_index=True)
    structure_id = models.IntegerField('unité', db_index=True)
    periode = models.CharField('période', max_length=64, db_index=True)
    element_id = models.IntegerField('élément de données')
    valeur = models.CharField('valeur justifiée', max_length=64, blank=True)
    motif = models.CharField('anomalie signalée', max_length=255, blank=True)
    texte = models.TextField('justification')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='auteur')
    date = models.DateTimeField('date', auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'justification'
        verbose_name_plural = 'justifications des anomalies'
        constraints = [models.UniqueConstraint(fields=['dataset_id', 'structure_id', 'periode', 'element_id'], name='saisie_plus_justif_unique')]

    def __str__(self):
        return f'Élément {self.element_id} · unité {self.structure_id} · {self.periode}'


def _chemin_logo(instance, filename):
    import os, uuid
    ext = os.path.splitext(filename)[1].lower()
    return f'entetes/{instance.institution_id}/{uuid.uuid4().hex[:12]}{ext}'


class EnTete(models.Model):
    """En-tête affiché en haut des formulaires à la saisie et sur la fiche imprimée.
    dataset_id vide = en-tête par défaut de toute l'organisation ; renseigné = propre à un formulaire."""
    institution_id = models.IntegerField('organisation', db_index=True)
    dataset_id = models.IntegerField('formulaire', null=True, blank=True, db_index=True)
    logo = models.FileField('logo de l’organisation', upload_to=_chemin_logo, blank=True, null=True)
    logo_partenaire = models.FileField('logo du partenaire / bailleur', upload_to=_chemin_logo, blank=True, null=True)
    ligne1 = models.CharField('ligne 1 (organisation)', max_length=160, blank=True)
    ligne2 = models.CharField('ligne 2 (projet, programme)', max_length=160, blank=True)
    ligne3 = models.CharField('ligne 3 (mention)', max_length=160, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'en-tête de formulaire'
        verbose_name_plural = 'en-têtes de formulaires'
        constraints = [models.UniqueConstraint(fields=['institution_id', 'dataset_id'], name='saisie_plus_entete_unique')]

    def __str__(self):
        return f'En-tête {self.institution_id}' + (f' · formulaire {self.dataset_id}' if self.dataset_id else ' · par défaut')


# ======================================================================
#  Pièces jointes des champs « Fichier » et « Photo »
# ======================================================================
def _stockage_prive():
    """Hors de MEDIA_ROOT : nginx ne sert jamais ces fichiers directement.
    Ils passent par /saisie-plus/fichier/<id>/, qui vérifie les droits."""
    import os
    from django.core.files.storage import FileSystemStorage
    return FileSystemStorage(location=getattr(settings, 'PRIVATE_MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'prive')))


def _chemin_piece(instance, filename):
    import os, uuid
    from django.utils import timezone
    ext = os.path.splitext(filename)[1].lower()
    return f'pieces/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}'      # nom aléatoire, jamais le nom d'origine


class PieceJointe(models.Model):
    """Fichier envoyé depuis la page de saisie. La valeur du data element (DSet_DElt.fichier_element) pointe ici."""
    fichier = models.FileField('fichier', upload_to=_chemin_piece, storage=_stockage_prive, max_length=200)
    nom = models.CharField('nom d’origine', max_length=255)
    type_mime = models.CharField('type', max_length=100)
    taille = models.PositiveIntegerField('taille (octets)')
    sha256 = models.CharField(max_length=64, db_index=True)
    est_image = models.BooleanField(default=False)
    dataset_id = models.IntegerField('formulaire', null=True, blank=True, db_index=True)
    structure_id = models.IntegerField('unité', null=True, blank=True, db_index=True)
    periode = models.CharField('période', max_length=64, blank=True)
    element_id = models.IntegerField('élément de données', null=True, blank=True)
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='envoyé par')
    date = models.DateTimeField('date', auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'pièce jointe'
        verbose_name_plural = 'pièces jointes'

    def __str__(self):
        return self.nom
