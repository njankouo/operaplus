"""À inclure dans urls.py du projet :   path('terrain/', include('collecte.urls')),"""
from django.urls import path

from . import views as v

urlpatterns = [
    path('', v.pwa, name='collecte_pwa'),
    path('manifest.webmanifest', v.manifeste, name='collecte_manifeste'),
    path('sw.js', v.service_worker, name='collecte_sw'),
    path('api/ping/', v.api_ping, name='collecte_ping'),
    path('api/paquet/', v.api_paquet, name='collecte_paquet'),
    path('api/soumission/', v.api_soumission, name='collecte_soumission'),
    path('api/piece/', v.api_piece, name='collecte_piece'),
    path('api/declaration/', v.api_declaration, name='collecte_declaration'),
    path('api/etat/', v.api_etat, name='collecte_etat'),
    path('gestion/', v.g_accueil, name='collecte_g_accueil'),
    path('gestion/formulaire/nouveau/', v.g_formulaire, name='collecte_g_nouveau'),
    path('gestion/formulaire/<int:pk>/', v.g_formulaire, name='collecte_g_formulaire'),
    path('gestion/formulaire/<int:pk>/donnees/', v.g_donnees, name='collecte_g_donnees'),
    path('gestion/piece/<uuid:uuid>/', v.g_piece, name='collecte_g_piece'),
    path('gestion/declarations/', v.g_declarations, name='collecte_g_declarations'),
]
