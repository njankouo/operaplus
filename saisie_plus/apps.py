from django.apps import AppConfig


class SaisiePlusConfig(AppConfig):
    """Compléments de la page de saisie OperaPlus : justifications des anomalies et journal des saisies.
    Application séparée : ctn_bpf/views.py n'est pas modifié."""
    default_auto_field = 'django.db.models.AutoField'
    name = 'saisie_plus'
    verbose_name = 'Saisie : justifications et traçabilité'
