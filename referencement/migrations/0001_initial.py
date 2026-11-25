from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name='Redirection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ancien', models.CharField(help_text='Chemin seul, ex. /actualites/ancien-titre/', max_length=500, unique=True, verbose_name='Ancienne adresse')),
                ('nouveau', models.CharField(help_text='Chemin ou adresse complète', max_length=500, verbose_name='Nouvelle adresse')),
                ('nb_visites', models.PositiveIntegerField(default=0, verbose_name='Visites redirigées')),
                ('automatique', models.BooleanField(default=False)),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('derniere_visite', models.DateTimeField(blank=True, null=True)),
            ],
            options={'verbose_name': 'redirection', 'ordering': ['-date_creation']},
        ),
    ]
