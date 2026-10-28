from celery import Celery
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Opera_CTN.settings')

app = Celery('Opera_CTN')

app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()