from django.db import models


class Redirection(models.Model):
    """Ancienne adresse → nouvelle adresse (301). Créée automatiquement quand l'adresse d'un article change,
    ou à la main dans l'administration (ancienne page supprimée, rubrique renommée…)."""
    ancien = models.CharField('Ancienne adresse', max_length=500, unique=True, help_text='Chemin seul, ex. /actualites/ancien-titre/')
    nouveau = models.CharField('Nouvelle adresse', max_length=500, help_text='Chemin ou adresse complète')
    nb_visites = models.PositiveIntegerField('Visites redirigées', default=0)
    automatique = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)
    derniere_visite = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'redirection'
        ordering = ['-date_creation']

    def __str__(self):
        return '%s → %s' % (self.ancien, self.nouveau)
