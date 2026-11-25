"""IndexNow : prévient Bing, Yandex, Seznam, Naver… dès qu'une page est publiée, modifiée ou supprimée.
(Google ne participe pas à IndexNow : pour lui, ce sont les sitemaps et Search Console.)

REFERENCEMENT['INDEXNOW'] = {'CLE': 'une-cle-de-32-caracteres-hexadecimaux'}
La clé est servie automatiquement à l'adresse /<cle>.txt (voir urls.py), c'est ainsi que les moteurs vérifient le site.
Générer une clé :  python -c "import secrets; print(secrets.token_hex(16))"
"""
import json
import logging
import threading
import urllib.request
from urllib.parse import urlparse

from django.conf import settings

from .conf import absolue, reglage

journal = logging.getLogger('referencement.indexnow')
POINT_DACCES = 'https://api.indexnow.org/indexnow'


def cle():
    return (reglage('INDEXNOW') or {}).get('CLE', '')


def actif():
    return bool(cle()) and reglage('INDEXER') and not settings.DEBUG


def _envoyer(urls):
    corps = json.dumps({'host': urlparse(reglage('URL')).netloc, 'key': cle(),
                        'keyLocation': absolue('/%s.txt' % cle()), 'urlList': urls}).encode()
    req = urllib.request.Request(POINT_DACCES, data=corps, method='POST',
                                 headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            journal.info('IndexNow : %d adresse(s) envoyée(s), réponse %s', len(urls), r.status)
    except Exception as e:                                   # jamais d'erreur visible pour l'utilisateur
        journal.warning('IndexNow : échec de l’envoi (%s)', e)


def signaler(*chemins):
    """Envoie les adresses en tâche de fond (la sauvegarde de l'article n'attend pas la réponse)."""
    urls = list(dict.fromkeys(absolue(c) for c in chemins if c))
    if urls and actif():
        threading.Thread(target=_envoyer, args=(urls[:10000],), daemon=True).start()
    return urls
