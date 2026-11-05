import django.db.models.deletion
import saisie_plus.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("saisie_plus", "0002_entete"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PieceJointe",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fichier", models.FileField(max_length=200, storage=saisie_plus.models._stockage_prive, upload_to=saisie_plus.models._chemin_piece, verbose_name="fichier")),
                ("nom", models.CharField(max_length=255, verbose_name="nom d’origine")),
                ("type_mime", models.CharField(max_length=100, verbose_name="type")),
                ("taille", models.PositiveIntegerField(verbose_name="taille (octets)")),
                ("sha256", models.CharField(db_index=True, max_length=64)),
                ("est_image", models.BooleanField(default=False)),
                ("dataset_id", models.IntegerField(blank=True, db_index=True, null=True, verbose_name="formulaire")),
                ("structure_id", models.IntegerField(blank=True, db_index=True, null=True, verbose_name="unité")),
                ("periode", models.CharField(blank=True, max_length=64, verbose_name="période")),
                ("element_id", models.IntegerField(blank=True, null=True, verbose_name="élément de données")),
                ("date", models.DateTimeField(auto_now_add=True, verbose_name="date")),
                ("auteur", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name="envoyé par")),
            ],
            options={"verbose_name": "pièce jointe", "verbose_name_plural": "pièces jointes", "ordering": ["-date"]},
        ),
    ]
