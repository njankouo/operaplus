"""
Application « collecte » — OperaPlus Terrain (PWA hors ligne).
Indépendante : se relie aux modèles existants par identifiants (institution, opération, échéance).
"""
import uuid

from django.conf import settings
from django.db import models

TYPES_QUESTION = [
    ('texte', 'Texte court'), ('paragraphe', 'Texte long'), ('entier', 'Nombre entier'), ('nombre', 'Nombre décimal'),
    ('choix', 'Choix unique'), ('choix_multiple', 'Choix multiple'), ('oui_non', 'Oui / Non'), ('date', 'Date'),
    ('gps', 'Position GPS'), ('photo', 'Photo'), ('signature', 'Signature'), ('note', 'Information (sans réponse)'),
]


class Formulaire(models.Model):
    """Questionnaire de terrain. `questions` = liste JSON :
    [{"id": "q1", "libelle": "...", "type": "choix", "obligatoire": true, "choix": ["A", "B"],
      "min": null, "max": null, "aide": "", "si": {"question": "q0", "valeur": "Oui"}}]"""
    titre = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    institution_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    questions = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    actif = models.BooleanField(default=False, help_text='Visible sur les téléphones')
    gps_obligatoire = models.BooleanField(default=False)
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-maj_le']
        permissions = [('gerer_collecte', 'Peut créer des questionnaires et valider les données de terrain')]

    def __str__(self):
        return self.titre


class Soumission(models.Model):
    STATUTS = [('recu', 'Reçu'), ('valide', 'Validé'), ('rejete', 'Rejeté')]
    uuid = models.UUIDField(unique=True, default=uuid.uuid4)
    formulaire = models.ForeignKey(Formulaire, on_delete=models.PROTECT, related_name='soumissions')
    version_formulaire = models.PositiveIntegerField(default=1)
    donnees = models.JSONField(default=dict)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    precision_m = models.FloatField(null=True, blank=True)
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='soumissions_terrain')
    institution_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    appareil = models.CharField(max_length=200, blank=True)
    cree_le_terrain = models.DateTimeField(null=True, blank=True, help_text='Heure de saisie sur le téléphone')
    recu_le = models.DateTimeField(auto_now_add=True)
    pieces_attendues = models.PositiveSmallIntegerField(default=0)
    statut = models.CharField(max_length=10, choices=STATUTS, default='recu')
    commentaire_validation = models.CharField(max_length=255, blank=True)
    valide_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-recu_le']

    def complete(self):
        return self.pieces.count() >= self.pieces_attendues


class PieceJointe(models.Model):
    uuid = models.UUIDField(unique=True, default=uuid.uuid4)
    soumission = models.ForeignKey(Soumission, on_delete=models.CASCADE, related_name='pieces')
    question_id = models.CharField(max_length=60)
    fichier = models.FileField(upload_to='collecte/%Y/%m/', max_length=255)
    recu_le = models.DateTimeField(auto_now_add=True)


class Declaration(models.Model):
    """Déclaration d'avancement faite hors ligne, rejouée ensuite dans la vue existante d'OperaPlus."""
    STATUTS = [('recu', 'Reçue'), ('integre', 'Intégrée'), ('rejete', 'Refusée'), ('erreur', 'Erreur technique')]
    uuid = models.UUIDField(unique=True, default=uuid.uuid4)
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='declarations_terrain')
    institution_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    operation_id = models.PositiveIntegerField(db_index=True)
    echeance_id = models.PositiveIntegerField(null=True, blank=True)
    operation_nom = models.CharField(max_length=255, blank=True)
    niveau = models.DecimalField(max_digits=6, decimal_places=2)
    commentaire = models.TextField()
    date_realisation = models.DateField(null=True, blank=True)
    fichier = models.FileField(upload_to='collecte/declarations/%Y/%m/', blank=True, max_length=255)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    precision_m = models.FloatField(null=True, blank=True)
    cree_le_terrain = models.DateTimeField(null=True, blank=True)
    recu_le = models.DateTimeField(auto_now_add=True)
    statut = models.CharField(max_length=10, choices=STATUTS, default='recu')
    message = models.CharField(max_length=500, blank=True)
    essais_integration = models.PositiveSmallIntegerField(default=0)
    integre_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-recu_le']
