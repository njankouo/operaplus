from django.db.models import F
from django.http import HttpResponsePermanentRedirect
from django.utils import timezone

from .conf import est_prive, reglage


class NonIndexationMiddleware:
    """Ajoute « X-Robots-Tag: noindex » sur les pages privées (réglage PRIVE) et sur tout le site si INDEXER = False.
    À placer dans MIDDLEWARE, après SecurityMiddleware."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        reponse = self.get_response(request)
        if not reglage('INDEXER') or est_prive(request.path):
            reponse['X-Robots-Tag'] = 'noindex, nofollow'
        return reponse


class RedirectionMiddleware:
    """Quand une page renvoie 404, cherche une redirection enregistrée et renvoie un 301 vers la nouvelle adresse.
    Ne coûte rien sur les pages qui existent (la base n'est consultée que sur les 404). À placer en DERNIER dans MIDDLEWARE."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        reponse = self.get_response(request)
        if reponse.status_code != 404:
            return reponse
        from .models import Redirection
        chemin = request.path
        variantes = [chemin, chemin.rstrip('/') or '/', chemin if chemin.endswith('/') else chemin + '/']
        r = Redirection.objects.filter(ancien__in=variantes).first()
        if r is None:
            return reponse
        Redirection.objects.filter(pk=r.pk).update(nb_visites=F('nb_visites') + 1, derniere_visite=timezone.now())
        cible = r.nouveau
        if request.META.get('QUERY_STRING') and '?' not in cible:
            cible += '?' + request.META['QUERY_STRING']
        return HttpResponsePermanentRedirect(cible)
