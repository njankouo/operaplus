"""Sitemaps construits à partir des réglages, sans écrire une classe par modèle.

REFERENCEMENT['SITEMAPS'] = {
    'pages':      {'urls': ['/', '/a-propos/', '/contact/'], 'priorite': 0.8},
    'actualites': {'modele': 'journal.Actualite', 'date': 'date_publication', 'filtre': {'publie': True},
                   'news': True, 'flux': True, 'titre': 'titre', 'image': 'image', 'lies': 'rubrique',
                   'frequence': 'daily', 'priorite': 0.7},
    'debats':     {'modele': 'journal.Debat', 'date': 'date_publication', 'news': True, 'flux': True},
    'rubriques':  {'modele': 'journal.Rubrique', 'priorite': 0.5},
}
- chaque modèle doit avoir get_absolute_url() ;
- « news » : aussi dans /sitemap-news.xml (moins de 2 jours) ;   « flux » : aussi dans le flux RSS /flux.xml ;
- « image » : nom du champ image (ajouté au sitemap pour Google Images) ;
- « lies » : champ commun utilisé par {% articles_lies %} (rubrique, catégorie…) ;
- « langue » : nom du champ qui contient la langue de l'objet ('fr'/'en'), sur un site bilingue ;
- « modifie » : champ de date de modification, si différent de « date ».
"""
from django.apps import apps
from django.contrib.sitemaps import Sitemap

from .conf import absolue, alternatives, reglage


def _avec_extras(urls, objet_de, image_de):
    for u in urls:
        obj = objet_de(u['item'])
        alt = alternatives(_chemin(u['location']), obj)
        u['alternates'] = [{'lang_code': k, 'location': v} for k, v in alt.items() if k != 'x-default']
        if 'x-default' in alt:
            u['alternates'].append({'lang_code': 'x-default', 'location': alt['x-default']})
        img = image_de(u['item'])
        u['images'] = [img] if img else []
    return urls


def _chemin(url):
    reste = url.split('://', 1)[-1]
    return '/' + reste.split('/', 1)[1] if '/' in reste else '/'


class PagesFixes(Sitemap):
    def __init__(self, urls, priorite=0.8, frequence='weekly'):
        self.urls_fixes, self.priority, self.changefreq = urls, priorite, frequence

    def items(self):
        return self.urls_fixes

    def location(self, item):
        return item

    def _urls(self, page, protocol, domain):
        return _avec_extras(super()._urls(page, protocol, domain), lambda i: None, lambda i: None)


class SitemapModele(Sitemap):
    def __init__(self, conf):
        self.conf = conf
        self.modele = apps.get_model(conf['modele'])
        self.priority = conf.get('priorite', 0.6)
        self.changefreq = conf.get('frequence', 'weekly')
        self.limit = conf.get('limite', 5000)

    def items(self):
        qs = self.modele._default_manager.filter(**self.conf.get('filtre', {}))
        champ = self.conf.get('date')
        return qs.order_by('-' + champ) if champ else qs.order_by('-pk')

    def lastmod(self, obj):
        champ = self.conf.get('modifie') or self.conf.get('date')
        return getattr(obj, champ, None) if champ else None

    def image(self, obj):
        champ = self.conf.get('image')
        f = getattr(obj, champ, None) if champ else None
        try:
            return absolue(f.url) if f else None
        except ValueError:                                   # champ fichier vide
            return None

    def _urls(self, page, protocol, domain):
        return _avec_extras(super()._urls(page, protocol, domain), lambda i: i, self.image)


def sitemaps():
    """Dictionnaire à passer à django.contrib.sitemaps.views.sitemap (voir urls.py)."""
    sortie = {}
    for nom, conf in reglage('SITEMAPS').items():
        sortie[nom] = PagesFixes(conf['urls'], conf.get('priorite', 0.8), conf.get('frequence', 'weekly')) if 'urls' in conf else SitemapModele(conf)
    return sortie
