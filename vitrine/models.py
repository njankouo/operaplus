"""Contenus du site vitrine, gérés depuis l'admin. Aucune donnée n'est inventée :
une section ne s'affiche que si vous y avez publié du contenu."""
from django.conf import settings
from django.db import models


class Partenaire(models.Model):
    nom = models.CharField(max_length=120)
    logo = models.ImageField(upload_to="vitrine/partenaires/", help_text="PNG ou SVG sur fond transparent, ~240×80")
    site = models.URLField(blank=True)
    accord_affichage = models.BooleanField(
        default=False, help_text="Cochez uniquement si l'organisation a accepté que son logo soit affiché.")
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]
        verbose_name = "partenaire"

    def __str__(self):
        return self.nom


class Temoignage(models.Model):
    citation = models.TextField(max_length=420)
    auteur = models.CharField(max_length=120)
    fonction = models.CharField(max_length=120, help_text="Ex. : Chargée de suivi-évaluation")
    organisation = models.CharField(max_length=120)
    photo = models.ImageField(upload_to="vitrine/temoignages/", blank=True)
    accord_publication = models.BooleanField(
        default=False, help_text="Cochez uniquement avec l'accord écrit de la personne citée.")
    publie = models.BooleanField(default=False)
    ordre = models.PositiveIntegerField(default=0)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ordre", "-cree_le"]
        verbose_name = "témoignage"

    def __str__(self):
        return f"{self.auteur} — {self.organisation}"


class MessageContact(models.Model):
    BESOINS = [("demo", "Démonstration"), ("devis", "Proposition / devis"), ("support", "Support"), ("autre", "Autre")]
    nom = models.CharField(max_length=120)
    email = models.EmailField()
    organisation = models.CharField(max_length=160, blank=True)
    besoin = models.CharField(max_length=20, choices=BESOINS, default="demo")
    projets = models.PositiveIntegerField(null=True, blank=True)
    utilisateurs = models.PositiveIntegerField(null=True, blank=True)
    message = models.TextField(max_length=3000)
    consentement = models.BooleanField(default=False)
    ip_hachee = models.CharField(max_length=64, blank=True, help_text="Empreinte de l'adresse IP (jamais l'IP en clair)")
    recu_le = models.DateTimeField(auto_now_add=True)
    traite = models.BooleanField(default=False)

    class Meta:
        ordering = ["-recu_le"]
        verbose_name = "message de contact"

    def __str__(self):
        return f"{self.nom} <{self.email}> — {self.get_besoin_display()}"


class MembreMealAfrique(models.Model):
    """Lien entre un compte OperaPlus et la communauté MEAL Afrique (pour le badge)."""
    utilisateur = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="membre_meal_afrique")
    depuis = models.DateField(auto_now_add=True)
    profil_url = models.URLField(blank=True, help_text="Lien vers le profil expert sur MEAL Afrique")

    class Meta:
        verbose_name = "membre MEAL Afrique"

    def __str__(self):
        return str(self.utilisateur)
