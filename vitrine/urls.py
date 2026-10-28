"""À inclure dans votre urls.py principal :
    path("", include("vitrine.urls")),
(placez-le APRÈS vos propres routes pour ne rien masquer)."""
from django.urls import path

from . import views

app_name = "vitrine"

urlpatterns = [
    path("fonctionnalites/<slug:slug>/", views.fonctionnalite, name="fonctionnalite"),
    path("securite/", views.page, {"slug": "securite"}, name="securite"),
    path("mentions-legales/", views.page, {"slug": "mentions-legales"}, name="mentions"),
    path("confidentialite/", views.page, {"slug": "confidentialite"}, name="confidentialite"),
    path("en/", views.accueil_en, name="en"),
    path("contact/envoyer/", views.contact, name="contact"),
    path("robots.txt", views.robots_txt, name="robots"),
    path("sitemap.xml", views.sitemap_xml, name="sitemap"),
]
