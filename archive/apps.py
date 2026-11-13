from django.apps import AppConfig


class ArchiveConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'archive'
    verbose_name = 'Archivage numérique'

    def ready(self):
        from .signals import connecter
        connecter()
