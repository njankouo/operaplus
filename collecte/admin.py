from django.contrib import admin

from .models import Declaration, Formulaire, PieceJointe, Soumission


@admin.register(Formulaire)
class FormulaireAdmin(admin.ModelAdmin):
    list_display = ('titre', 'actif', 'version', 'institution_id', 'maj_le')
    list_filter = ('actif',)


class PieceInline(admin.TabularInline):
    model = PieceJointe
    extra = 0
    readonly_fields = ('uuid', 'question_id', 'fichier', 'recu_le')


@admin.register(Soumission)
class SoumissionAdmin(admin.ModelAdmin):
    list_display = ('pk', 'formulaire', 'agent', 'statut', 'cree_le_terrain', 'recu_le')
    list_filter = ('statut', 'formulaire')
    readonly_fields = ('uuid', 'donnees', 'recu_le', 'cree_le_terrain', 'appareil')
    inlines = [PieceInline]


@admin.register(Declaration)
class DeclarationAdmin(admin.ModelAdmin):
    list_display = ('pk', 'operation_nom', 'agent', 'niveau', 'statut', 'recu_le')
    list_filter = ('statut',)
    readonly_fields = ('uuid', 'recu_le', 'integre_le', 'message', 'essais_integration')
