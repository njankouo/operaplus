from django.apps import AppConfig


class ReferencementConfig(AppConfig):
    name = 'referencement'
    verbose_name = 'Référencement naturel'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        from .signaux import brancher
        brancher()
