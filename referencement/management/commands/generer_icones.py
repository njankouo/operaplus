"""Fabrique toutes les icônes du site à partir d'UNE image carrée (PNG, au moins 512 × 512).

    python manage.py generer_icones logo-carre.png                      → dans static/img/
    python manage.py generer_icones logo-carre.png --dossier static/img --fond "#123A37"

Crée : favicon.ico (16, 32, 48), icone-192.png, icone-512.png, apple-touch-icon.png (180, fond plein).
Nécessite Pillow (pip install Pillow), déjà présent si le projet utilise des ImageField.
"""
import os

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Génère favicon.ico et les icônes PNG à partir d’une image carrée.'

    def add_arguments(self, parser):
        parser.add_argument('source')
        parser.add_argument('--dossier', default='static/img')
        parser.add_argument('--fond', default='#ffffff', help='Couleur de fond de l’icône Apple (qui refuse la transparence).')

    def handle(self, *args, **o):
        try:
            from PIL import Image
        except ImportError:
            raise CommandError('Pillow est nécessaire : pip install Pillow')
        img = Image.open(o['source']).convert('RGBA')
        w, h = img.size
        if w != h:
            cote = min(w, h)                                   # recadrage au centre si l'image n'est pas carrée
            img = img.crop(((w - cote) // 2, (h - cote) // 2, (w + cote) // 2, (h + cote) // 2))
            self.stdout.write(self.style.WARNING('Image non carrée : recadrée au centre (%d × %d).' % (cote, cote)))
        if img.size[0] < 512:
            self.stdout.write(self.style.WARNING('Image de %d px : 512 px ou plus donnerait des icônes plus nettes.' % img.size[0]))
        os.makedirs(o['dossier'], exist_ok=True)
        chemin = lambda n: os.path.join(o['dossier'], n)
        img.save(chemin('favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
        for taille, nom in [(192, 'icone-192.png'), (512, 'icone-512.png')]:
            img.resize((taille, taille), Image.LANCZOS).save(chemin(nom), optimize=True)
        fond = Image.new('RGBA', (180, 180), o['fond'])
        fond.alpha_composite(img.resize((180, 180), Image.LANCZOS))
        fond.convert('RGB').save(chemin('apple-touch-icon.png'), optimize=True)
        for n in ['favicon.ico', 'icone-192.png', 'icone-512.png', 'apple-touch-icon.png']:
            self.stdout.write(self.style.SUCCESS('  %s' % chemin(n)))
        self.stdout.write('Pense à lancer « python manage.py collectstatic » en production.')
