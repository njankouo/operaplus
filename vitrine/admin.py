from django.contrib import admin

from .models import MembreMealAfrique, MessageContact, Partenaire, Temoignage


@admin.register(Partenaire)
class PartenaireAdmin(admin.ModelAdmin):
    list_display = ("nom", "accord_affichage", "ordre")
    list_editable = ("accord_affichage", "ordre")


@admin.register(Temoignage)
class TemoignageAdmin(admin.ModelAdmin):
    list_display = ("auteur", "organisation", "accord_publication", "publie", "ordre")
    list_editable = ("publie", "ordre")
    list_filter = ("publie", "accord_publication")


@admin.register(MessageContact)
class MessageContactAdmin(admin.ModelAdmin):
    list_display = ("nom", "email", "organisation", "besoin", "recu_le", "traite")
    list_filter = ("besoin", "traite")
    list_editable = ("traite",)
    search_fields = ("nom", "email", "organisation")
    readonly_fields = [f.name for f in MessageContact._meta.fields if f.name != "traite"]

    def has_add_permission(self, request):
        return False


@admin.register(MembreMealAfrique)
class MembreAdmin(admin.ModelAdmin):
    list_display = ("utilisateur", "depuis")
    search_fields = ("utilisateur__username", "utilisateur__email")
