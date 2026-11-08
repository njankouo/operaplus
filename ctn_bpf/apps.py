from django.apps import AppConfig


class CtnBpfConfig(AppConfig):
    name = 'ctn_bpf'

    def ready(self):
        import ctn_bpf.signals
