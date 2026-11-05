from django.urls import path

from . import views

app_name = 'saisie_plus'

urlpatterns = [
    path('api/journal/', views.journal, name='journal'),
    path('api/justifications/', views.justifications, name='justifications'),
    path('api/valeurs/<int:structure_id>/<str:periode>/', views.valeurs, name='valeurs'),
    path('api/en-tete/', views.en_tete_api, name='en_tete_api'),
    path('en-tete/', views.en_tete_page, name='en_tete'),
    path('api/completude/<int:dataset_id>/<str:periode>/', views.completude, name='completude'),
    path('api/fichiers/', views.fichiers, name='fichiers'),
    path('api/fichiers/<int:piece_id>/', views.fichier_info, name='fichier_info'),
    path('fichier/<int:piece_id>/', views.fichier, name='fichier'),
]
