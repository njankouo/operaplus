"""Vérifie les pages publiques comme le ferait un moteur de recherche.

    python manage.py audit_seo                 → toutes les URL du sitemap (200 au plus)
    python manage.py audit_seo / /debats/      → seulement ces pages
"""
import re
from html.parser import HTMLParser

from django.core.management.base import BaseCommand
from django.test import Client

from referencement.conf import reglage
from referencement.sitemaps import sitemaps


class Lecteur(HTMLParser):
    def __init__(self):
        super().__init__()
        self.titre, self.dans_titre, self.metas, self.liens, self.h1, self.imgs_sans_alt, self.jsonld, self.lang = '', False, {}, {}, 0, 0, 0, ''

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'html': self.lang = a.get('lang', '')
        if tag == 'title': self.dans_titre = True
        if tag == 'meta' and (a.get('name') or a.get('property')): self.metas[a.get('name') or a.get('property')] = a.get('content', '')
        if tag == 'link' and a.get('rel') == 'canonical': self.liens['canonical'] = a.get('href', '')
        if tag == 'h1': self.h1 += 1
        if tag == 'img' and 'alt' not in a: self.imgs_sans_alt += 1      # alt="" reste permis pour une image décorative
        if tag == 'script' and a.get('type') == 'application/ld+json': self.jsonld += 1

    def handle_endtag(self, tag):
        if tag == 'title': self.dans_titre = False

    def handle_data(self, data):
        if self.dans_titre: self.titre += data


class Command(BaseCommand):
    help = 'Audit de référencement des pages publiques (titre, description, H1, canonique, images, données structurées).'

    def add_arguments(self, parser):
        parser.add_argument('chemins', nargs='*')

    def handle(self, *args, **o):
        chemins = o['chemins'] or self.depuis_sitemap()
        client, titres, descs, problemes_total = Client(), {}, {}, 0
        for chemin in chemins:
            r = client.get(chemin, HTTP_HOST=re.sub(r'^https?://', '', reglage('URL')).split('/')[0] or 'localhost', secure=True)
            p = []
            if r.status_code != 200:
                self.stdout.write(self.style.ERROR('%s → code %s' % (chemin, r.status_code))); problemes_total += 1; continue
            L = Lecteur(); L.feed(r.content.decode('utf-8', 'ignore'))
            t, d = L.titre.strip(), L.metas.get('description', '')
            if not t: p.append('pas de <title>')
            elif len(t) > 65: p.append('titre trop long (%d car., viser 50–60)' % len(t))
            if t in titres: p.append('même titre que %s' % titres[t])
            titres.setdefault(t, chemin)
            if d and d in descs: p.append('même description que %s' % descs[d])
            descs.setdefault(d, chemin)
            if not d: p.append('pas de meta description')
            elif not 70 <= len(d) <= 160: p.append('description de %d car. (viser 120–158)' % len(d))
            if L.h1 != 1: p.append('%d balise(s) <h1> (il en faut une seule)' % L.h1)
            if not L.liens.get('canonical'): p.append('pas d’URL canonique')
            if 'noindex' in L.metas.get('robots', '') or 'noindex' in r.get('X-Robots-Tag', ''): p.append('page en noindex')
            if not L.metas.get('og:image'): p.append('pas d’image de partage (og:image)')
            if L.imgs_sans_alt: p.append('%d image(s) sans texte alternatif' % L.imgs_sans_alt)
            if not L.lang: p.append('<html> sans attribut lang')
            if not L.jsonld: p.append('aucune donnée structurée')
            problemes_total += len(p)
            if p:
                self.stdout.write(self.style.WARNING('%s' % chemin)); [self.stdout.write('   – ' + x) for x in p]
            else:
                self.stdout.write(self.style.SUCCESS('%s  ✓' % chemin))
        self.stdout.write('')
        self.stdout.write((self.style.SUCCESS if not problemes_total else self.style.WARNING)('%d page(s) vérifiée(s), %d point(s) à corriger.' % (len(chemins), problemes_total)))

    def depuis_sitemap(self):
        urls = []
        for sm in sitemaps().values():
            for item in list(sm.items())[:50]:
                urls.append(sm.location(item) if hasattr(sm, 'urls_fixes') else item.get_absolute_url())
        return list(dict.fromkeys(urls))[:200]
