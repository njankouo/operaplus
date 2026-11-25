"""Dans le urls.py principal :   path('', include('referencement.urls')),
(sur un site bilingue en préfixes /fr/ /en/ : à mettre HORS de i18n_patterns, ces fichiers restent à la racine)"""
from django.contrib.sitemaps.views import sitemap
from django.urls import path
from django.views.decorators.cache import cache_page

from . import views
from .flux import FluxSite
from .sitemaps import sitemaps

urlpatterns = [
    path('robots.txt', views.robots_txt, name='robots_txt'),
    path('favicon.ico', views.favicon, name='favicon'),
    path('sitemap.xml', cache_page(60 * 60)(sitemap), {'sitemaps': sitemaps(), 'template_name': 'referencement/sitemap.xml'},
         name='django.contrib.sitemaps.views.sitemap'),
    path('sitemap-news.xml', views.sitemap_news, name='sitemap_news'),
    path('flux.xml', FluxSite(), name='flux_rss'),
    path('<str:cle>.txt', views.cle_indexnow, name='indexnow_cle'),
]
