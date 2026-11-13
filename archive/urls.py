"""À inclure dans urls.py du projet :   path('archivage/', include('archive.urls')),"""
from django.urls import path

from . import views as v

urlpatterns = [
    path('', v.ar_tableau, name='ar_tableau'),
    path('sous-dossier/<int:pk>/', v.ar_liste, name='ar_liste'),
    path('document/<int:pk>/', v.ar_detail, name='ar_detail'),
    path('document/<int:pk>/fichier/', v.ar_fichier, name='ar_fichier'),
    path('document/<int:pk>/fiche/', v.ar_fiche, name='ar_fiche'),
    path('document/<int:pk>/version/', v.ar_version, name='ar_version'),
    path('version/<int:pk>/restaurer/', v.ar_version_restaurer, name='ar_version_restaurer'),
    path('document/<int:pk>/integrite/', v.ar_integrite, name='ar_integrite'),
    path('document/<int:pk>/gel/', v.ar_gel, name='ar_gel'),
    path('document/<int:pk>/partager/', v.ar_partager, name='ar_partager'),
    path('partage/<int:pk>/revoquer/', v.ar_partage_revoquer, name='ar_partage_revoquer'),
    path('p/<str:jeton>/', v.ar_partage_public, name='ar_partage_public'),
    path('document/<int:pk>/corbeille/', v.ar_corbeille_mettre, name='ar_corbeille_mettre'),
    path('document/<int:pk>/restaurer/', v.ar_restaurer, name='ar_restaurer'),
    path('document/<int:pk>/eliminer/', v.ar_eliminer, name='ar_eliminer'),
    path('corbeille/', v.ar_corbeille, name='ar_corbeille'),
    path('recherche/', v.ar_recherche, name='ar_recherche'),
    path('inventaire.csv', v.ar_inventaire, name='ar_inventaire'),
    path('bordereau-elimination/', v.ar_bordereau, name='ar_bordereau'),
    path('lot/', v.ar_lot, name='ar_lot'),
    path('lot/zip/', v.ar_lot_zip, name='ar_lot_zip'),
    path('deposer/', v.ar_deposer, name='ar_deposer'),
    path('regles/', v.ar_regles, name='ar_regles'),
    path('journal/', v.ar_journal, name='ar_journal'),
    path('inventorier/', v.ar_inventorier, name='ar_inventorier'),
    path('integrite/tout/', v.ar_integrite_tout, name='ar_integrite_tout'),
]
