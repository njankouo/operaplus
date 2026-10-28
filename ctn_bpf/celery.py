import os
from celery import Celery

# Définition des réglages Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Opera_CTN.settings')

app = Celery('ctn_bpf')

# Configuration via settings.py
app.config_from_object('django.conf:settings', namespace='CELERY')

# Détection automatique des tâches dans les fichiers tasks.py des apps
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')