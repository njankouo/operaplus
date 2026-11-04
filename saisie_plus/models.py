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
