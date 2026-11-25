from django.contrib import admin

from .models import Redirection


@admin.register(Redirection)
class RedirectionAdmin(admin.ModelAdmin):
    list_display = ('ancien', 'nouveau', 'nb_visites', 'automatique', 'derniere_visite')
    list_filter = ('automatique',)
    search_fields = ('ancien', 'nouveau')
    readonly_fields = ('nb_visites', 'derniere_visite', 'date_creation')
