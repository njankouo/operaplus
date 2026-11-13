from django.contrib import admin

from .models import ArchiveFiche, ArchiveJournal, ArchivePartage, ArchiveVersion, RegleConservation


@admin.register(ArchiveFiche)
class FicheAdmin(admin.ModelAdmin):
    list_display = ('cote', 'archive_id', 'type_document', 'confidentialite', 'version_courante', 'integrite_ok', 'supprime_le')
    list_filter = ('confidentialite', 'integrite_ok', 'gel_juridique')
    search_fields = ('cote', 'mots_cles', 'type_document')
    readonly_fields = ('archive_id', 'sha256', 'taille', 'fichier_nom', 'texte_extrait', 'cree_le', 'maj_le')
    filter_horizontal = ('acces',)


@admin.register(RegleConservation)
class RegleAdmin(admin.ModelAdmin):
    list_display = ('sous_categorie_id', 'dua_active', 'dua_intermediaire', 'sort_final', 'maj_le')


@admin.register(ArchiveVersion)
class VersionAdmin(admin.ModelAdmin):
    list_display = ('archive_id', 'numero', 'nom_original', 'cree_le')
    readonly_fields = [f.name for f in ArchiveVersion._meta.fields]


@admin.register(ArchivePartage)
class PartageAdmin(admin.ModelAdmin):
    list_display = ('archive_id', 'destinataire', 'expire_le', 'telechargements', 'actif')


@admin.register(ArchiveJournal)
class JournalAdmin(admin.ModelAdmin):
    """Piste d'audit en lecture seule."""
    list_display = ('date', 'action', 'cote', 'titre', 'nom_utilisateur', 'ip')
    list_filter = ('action',)
    search_fields = ('cote', 'titre', 'nom_utilisateur')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
