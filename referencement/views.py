import datetime

from django.apps import apps
from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import escape
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET

from .conf import absolue, reglage


@require_GET
@cache_page(60 * 60)
def robots_txt(request):
    if not reglage('INDEXER'):                       # serveur de test : rien n'est indexé
        return HttpResponse('User-agent: *\nDisallow: /\n', content_type='text/plain; charset=utf-8')
    lignes = ['User-agent: *']
    lignes += ['Disallow: %s' % p for p in reglage('PRIVE')]
    lignes += ['', 'Sitemap: %s' % absolue('/sitemap.xml')]
    if any(c.get('news') for c in reglage('SITEMAPS').values()):
        lignes.append('Sitemap: %s' % absolue('/sitemap-news.xml'))
    # le flux RSS n'a pas sa place dans robots.txt ; il est annoncé dans le <head> par {% seo %}
    return HttpResponse('\n'.join(lignes) + '\n', content_type='text/plain; charset=utf-8')


@require_GET
def cle_indexnow(request, cle):
    """/<clé>.txt : les moteurs IndexNow vérifient que la clé appartient bien au site."""
    from django.http import Http404
    from .indexnow import cle as ma_cle
    if not ma_cle() or cle != ma_cle():
        raise Http404
    return HttpResponse(ma_cle(), content_type='text/plain; charset=utf-8')


@require_GET
def favicon(request):
    """Beaucoup d'outils (et certains robots) demandent /favicon.ico à la racine, sans lire la page :
    on les renvoie vers le fichier rangé dans /static/."""
    from django.http import Http404, HttpResponsePermanentRedirect
    from django.templatetags.static import static
    chemin = (reglage('ICONES') or {}).get('ICO')
    if not chemin:
        raise Http404
    return HttpResponsePermanentRedirect(chemin if chemin.startswith(('http', '/')) else static(chemin))


@require_GET
@cache_page(60 * 10)
def sitemap_news(request):
    """Sitemap Google News : uniquement ce qui a été publié depuis moins de 2 jours (règle de Google), 1000 au plus."""
    limite = timezone.now() - datetime.timedelta(days=2)
    entrees = []
    for conf in reglage('SITEMAPS').values():
        if not conf.get('news') or 'modele' not in conf:
            continue
        modele, champ = apps.get_model(conf['modele']), conf['date']
        exemple = modele._meta.get_field(champ)
        seuil = limite if exemple.get_internal_type() == 'DateTimeField' else limite.date()
        qs = modele._default_manager.filter(**conf.get('filtre', {})).filter(**{champ + '__gte': seuil}).order_by('-' + champ)[:1000]
        for o in qs:
            d = getattr(o, champ)
            if not isinstance(d, datetime.datetime):
                d = datetime.datetime.combine(d, datetime.time(8, 0), tzinfo=timezone.get_current_timezone())
            langue = getattr(o, conf['langue'], None) if conf.get('langue') else None
            entrees.append((absolue(o.get_absolute_url()), d, str(getattr(o, conf.get('titre', 'titre'), o)), langue or reglage('LANGUE')))
    entrees.sort(key=lambda e: e[1], reverse=True)
    corps = ''.join(
        '<url><loc>%s</loc><news:news><news:publication><news:name>%s</news:name><news:language>%s</news:language></news:publication>'
        '<news:publication_date>%s</news:publication_date><news:title>%s</news:title></news:news></url>'
        % (escape(u), escape(reglage('NOM')), lg, d.isoformat(), escape(t)) for u, d, t, lg in entrees[:1000])
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
           'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">%s</urlset>' % corps)
    return HttpResponse(xml, content_type='application/xml; charset=utf-8')
