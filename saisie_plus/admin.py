from django.contrib import admin

from .models import EnTete, JournalSaisie, Justification, PieceJointe


@admin.register(JournalSaisie)
class JournalSaisieAdmin(admin.ModelAdmin):
    list_display = ('date', 'user', 'dataset_id', 'structure_id', 'periode', 'nb_valeurs', 'nb_modifiees')
    list_filter = ('dataset_id', 'periode')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')


@admin.register(Justification)
class JustificationAdmin(admin.ModelAdmin):
    list_display = ('date', 'user', 'dataset_id', 'structure_id', 'periode', 'element_id', 'valeur', 'texte')
    list_filter = ('dataset_id', 'periode')
    search_fields = ('texte', 'motif')


@admin.register(EnTete)
class EnTeteAdmin(admin.ModelAdmin):
    list_display = ('institution_id', 'dataset_id', 'ligne1', 'ligne2', 'date')


@admin.register(PieceJointe)
class PieceJointeAdmin(admin.ModelAdmin):
    list_display = ('date', 'nom', 'type_mime', 'taille', 'auteur', 'dataset_id', 'structure_id', 'periode', 'element_id')
    list_filter = ('type_mime', 'dataset_id')
    search_fields = ('nom', 'auteur__username')
    readonly_fields = ('sha256', 'taille', 'type_mime')
