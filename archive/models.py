"""
Application « archive » — modèles de l'archivage numérique.
Votre modèle d'archive existant n'est pas modifié : on s'y relie par son identifiant.
"""
import secrets
from datetime import date

from django.conf import settings
from django.db import models
from django.utils import timezone

from .utils import ajouter_annees

SORTS = [('conserver', 'Conservation définitive'), ('detruire', 'Destruction'), ('trier', 'Tri (décision au cas par cas)')]


def _dua_defaut():
    return getattr(settings, 'ARCHIVAGE_DUA_DEFAUT', (2, 5, 'trier'))


class RegleConservation(models.Model):
    """Durée d'utilité administrative (DUA) d'un sous-dossier : 3 âges des archives."""
    sous_categorie_id = models.PositiveIntegerField(unique=True)
    dua_active = models.PositiveSmallIntegerField('Durée active (années)', default=2)
    dua_intermediaire = models.PositiveSmallIntegerField('Durée intermédiaire (années)', default=5)
    sort_final = models.CharField(max_length=12, choices=SORTS, default='trier')
    observation = models.CharField(max_length=255, blank=True)
    maj_le = models.DateTimeField(auto_now=True)
    maj_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        verbose_name = 'règle de conservation'


class ArchiveFiche(models.Model):
    CONFIDENTIALITE = [('public', 'Public'), ('interne', 'Interne'), ('confidentiel', 'Confidentiel'), ('restreint', 'Restreint')]
    archive_id = models.PositiveIntegerField(unique=True)
    sous_categorie_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    cote = models.CharField(max_length=40, unique=True, null=True, blank=True)
    type_document = models.CharField(max_length=60, blank=True)
    date_document = models.DateField(null=True, blank=True)
    lieu = models.CharField(max_length=120, blank=True)
    langue = models.CharField(max_length=30, blank=True, default='Français')
    mots_cles = models.CharField(max_length=400, blank=True)
    confidentialite = models.CharField(max_length=12, choices=CONFIDENTIALITE, default='interne')
    acces = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='archives_autorisees')
    # conservation : vide = règle du sous-dossier
    dua_active = models.PositiveSmallIntegerField(null=True, blank=True)
    dua_intermediaire = models.PositiveSmallIntegerField(null=True, blank=True)
    sort_final = models.CharField(max_length=12, choices=SORTS, blank=True)
    gel_juridique = models.BooleanField(default=False)
    gel_motif = models.CharField(max_length=255, blank=True)
    # fichier et intégrité
    fichier_nom = models.CharField(max_length=255, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    taille = models.BigIntegerField(default=0)
    type_mime = models.CharField(max_length=100, blank=True)
    integrite_ok = models.BooleanField(null=True)
    integrite_verifiee_le = models.DateTimeField(null=True, blank=True)
    texte_extrait = models.TextField(blank=True)
    version_courante = models.PositiveIntegerField(default=1)
    commentaire_version = models.CharField(max_length=255, blank=True)
    # traçabilité
    depose_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='archives_deposees')
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le = models.DateTimeField(auto_now=True)
    supprime_le = models.DateTimeField(null=True, blank=True, db_index=True)
    supprime_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    motif_suppression = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "fiche d'archive"
        permissions = [('administrer_archives', 'Peut administrer les archives (règles, élimination, journal)')]

    # ----- cycle de vie (3 âges)
    def durees(self):
        r = getattr(self, '_regle', 'x')
        if r == 'x':
            r = RegleConservation.objects.filter(sous_categorie_id=self.sous_categorie_id).first() if self.sous_categorie_id else None
            self._regle = r
        d = _dua_defaut()
        a = self.dua_active if self.dua_active is not None else (r.dua_active if r else d[0])
        i = self.dua_intermediaire if self.dua_intermediaire is not None else (r.dua_intermediaire if r else d[1])
        s = self.sort_final or (r.sort_final if r else d[2])
        return a, i, s

    def source_regle(self):
        if self.dua_active is not None or self.dua_intermediaire is not None or self.sort_final:
            return 'document'
        self.durees()
        return 'sous-dossier' if getattr(self, '_regle', None) else 'défaut'

    def date_reference(self):
        return self.date_document or (timezone.localdate(self.cree_le) if self.cree_le else date.today())

    def fin_active(self):
        return ajouter_annees(self.date_reference(), self.durees()[0])

    def fin_intermediaire(self):
        a, i, _ = self.durees()
        return ajouter_annees(self.date_reference(), a + i)

    def phase(self):
        if self.supprime_le:
            return ('corbeille', 'Corbeille')
        if self.gel_juridique:
            return ('gel', 'Gel juridique')
        t = date.today()
        if t < self.fin_active():
            return ('actif', 'Actif')
        if t < self.fin_intermediaire():
            return ('intermediaire', 'Intermédiaire')
        return {'conserver': ('definitif', 'Définitif'), 'detruire': ('a_eliminer', 'À éliminer')}.get(self.durees()[2], ('a_trier', 'À trier'))

    def prochaine_echeance(self):
        t = date.today()
        for d in (self.fin_active(), self.fin_intermediaire()):
            if d > t:
                return d
        return None

    def liste_mots_cles(self):
        return [m.strip() for m in self.mots_cles.split(',') if m.strip()]

    def sort_final_effectif_display(self):
        return dict(SORTS).get(self.durees()[2], '')


class ArchiveVersion(models.Model):
    """Versions précédentes d'un document (la version courante est le fichier de l'archive)."""
    archive_id = models.PositiveIntegerField(db_index=True)
    numero = models.PositiveIntegerField()
    fichier = models.FileField(upload_to='archives/versions/%Y/%m/', max_length=255)
    nom_original = models.CharField(max_length=255, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    taille = models.BigIntegerField(default=0)
    commentaire = models.CharField(max_length=255, blank=True)
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    cree_le = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-numero']
        unique_together = [('archive_id', 'numero')]


class ArchiveJournal(models.Model):
    """Piste d'audit : jamais modifiée, conservée même après élimination du document."""
    ACTIONS = [
        ('creation', 'Dépôt'), ('inventaire', 'Inventaire initial'), ('consultation', 'Consultation'),
        ('telechargement', 'Téléchargement'), ('telechargement_partage', 'Téléchargement via lien partagé'),
        ('modification', 'Modification de la fiche'), ('nouvelle_version', 'Nouvelle version'),
        ('restauration_version', 'Restauration de version'), ('deplacement', 'Déplacement'),
        ('integrite', "Contrôle d'intégrité"), ('gel', 'Gel juridique'), ('degel', 'Levée du gel'),
        ('partage', 'Lien de partage créé'), ('partage_revoque', 'Lien de partage révoqué'),
        ('corbeille', 'Mise à la corbeille'), ('restauration', 'Restauration'),
        ('elimination', 'Élimination définitive'), ('suppression_externe', 'Suppression (hors module)'),
        ('export', 'Export'), ('regle', 'Règle de conservation'),
    ]
    archive_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    titre = models.CharField(max_length=255, blank=True)
    cote = models.CharField(max_length=40, blank=True)
    action = models.CharField(max_length=30, choices=ACTIONS)
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    nom_utilisateur = models.CharField(max_length=150, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    date = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-date']


def _jeton():
    return secrets.token_urlsafe(24)


class ArchivePartage(models.Model):
    """Lien de téléchargement temporaire pour une personne extérieure (bailleur, auditeur)."""
    jeton = models.CharField(max_length=40, unique=True, default=_jeton)
    archive_id = models.PositiveIntegerField(db_index=True)
    destinataire = models.CharField(max_length=150, blank=True)
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    cree_le = models.DateTimeField(auto_now_add=True)
    expire_le = models.DateTimeField()
    telechargements_max = models.PositiveIntegerField(null=True, blank=True)
    telechargements = models.PositiveIntegerField(default=0)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ['-cree_le']

    def valide(self):
        return self.actif and self.expire_le > timezone.now() and (self.telechargements_max is None or self.telechargements < self.telechargements_max)
