"""Flux RSS du site (/flux.xml) : les 30 derniers contenus des modèles marqués « flux »: True dans SITEMAPS.
Les agrégateurs, Google Actualités, Feedly, LinkedIn… s'en servent pour découvrir les nouveaux articles."""
from django.apps import apps
from django.contrib.syndication.views import Feed
from django.utils.feedgenerator import Rss201rev2Feed
from django.utils.html import strip_tags
from django.utils.text import Truncator

from .conf import absolue, langue_courante, reglage


def _attr(obj, *noms):
    for n in noms:
        v = getattr(obj, n, None)
        if v:
            return v
    return None


class FluxSite(Feed):
    feed_type = Rss201rev2Feed

    def title(self):
        return reglage('NOM')

    def description(self):
        return reglage('DESCRIPTION')

    def link(self):
        return '/'

    def feed_url(self):
        return absolue('/flux.xml')

    def items(self):
        tous = []
        for conf in reglage('SITEMAPS').values():
            if not conf.get('flux') or 'modele' not in conf:
                continue
            qs = apps.get_model(conf['modele'])._default_manager.filter(**conf.get('filtre', {}))
            if conf.get('langue') and len(reglage('LANGUES') or {}) > 1:
                qs = qs.filter(**{conf['langue']: langue_courante()})
            qs = qs.order_by('-' + conf['date'])[:30]
            tous += [(getattr(o, conf['date']), o, conf) for o in qs]
        tous.sort(key=lambda t: t[0] if hasattr(t[0], 'hour') else _a_minuit(t[0]), reverse=True)
        return tous[:30]

    def item_title(self, item):
        return str(_attr(item[1], item[2].get('titre', 'titre'), 'titre', 'title', 'nom') or item[1])

    def item_description(self, item):
        texte = _attr(item[1], 'chapeau', 'resume', 'description', 'contenu', 'texte')
        return Truncator(' '.join(strip_tags(str(texte or '')).split())).chars(400, truncate='…')

    def item_link(self, item):
        return item[1].get_absolute_url()

    def item_pubdate(self, item):
        return item[0] if hasattr(item[0], 'hour') else _a_minuit(item[0])

    def item_author_name(self, item):
        a = _attr(item[1], 'auteur', 'author')
        return str(a) if a else None

    def item_enclosure_url(self, item):
        champ = item[2].get('image')
        f = getattr(item[1], champ, None) if champ else None
        try:
            return absolue(f.url) if f else None
        except ValueError:
            return None

    item_enclosure_length = 0

    def item_enclosure_mime_type(self, item):
        url = self.item_enclosure_url(item) or ''
        return 'image/webp' if url.endswith('.webp') else 'image/png' if url.endswith('.png') else 'image/jpeg'


def _a_minuit(d):
    import datetime
    from django.utils import timezone
    return datetime.datetime.combine(d, datetime.time(8, 0), tzinfo=timezone.get_current_timezone())
