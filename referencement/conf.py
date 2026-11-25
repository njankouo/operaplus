"""Réglages du référencement, lus dans settings.REFERENCEMENT (un dictionnaire par site).

Exemple pour MEAL Afrique (voir README.md pour OperaPlus) :

REFERENCEMENT = {
    'NOM': 'MEAL Afrique',
    'URL': 'https://www.mealafrique.com',          # sans « / » final, en https
    'DESCRIPTION': 'Le journal du suivi-évaluation en Afrique : actualités, débats et outils MEAL.',
    'LANGUE': 'fr',                                # langue du site (balise <html lang> et Open Graph)
    'REGION': 'fr_CM',                              # Open Graph locale
    'IMAGE': '/static/img/partage.jpg',            # image de partage par défaut (1200 × 630)
    'LOGO': '/static/img/logo.png',                # logo carré (au moins 112 × 112)
    'TWITTER': '@mealafrique',
    'RESEAUX': ['https://www.facebook.com/…', 'https://www.linkedin.com/company/…'],
    'TYPE_ORGANISATION': 'NewsMediaOrganization',  # ou 'Organization'
    'SITES_LIES': [{'nom': 'OperaPlus', 'url': 'https://www.operaplus.app', 'description': 'La plateforme MEAL'}],
    'PRIVE': ['/admin/', '/compte/', '/api/'],     # préfixes d'URL à ne jamais indexer
    'SITEMAPS': { … },                             # voir sitemaps.py
}
"""
from django.conf import settings

DEFAUTS = {
    'NOM': '', 'URL': '', 'DESCRIPTION': '', 'LANGUE': 'fr', 'REGION': 'fr_FR',
    'IMAGE': '', 'LOGO': '', 'TWITTER': '', 'RESEAUX': [], 'TYPE_ORGANISATION': 'Organization',
    'SITES_LIES': [], 'PRIVE': ['/admin/'], 'SITEMAPS': {}, 'SEPARATEUR': ' · ',
    # Liste blanche. Si elle est remplie, TOUTE page absente de la liste passe en noindex.
    #   '/packages/'         → cette adresse exacte
    #   '/fonctionnalites/*' → cette adresse et tout ce qui est en dessous
    'PUBLIC': [],
    'RECHERCHE': '',          # ex. '/recherche/?q={search_term_string}' → champ de recherche dans Google
    'INDEXER': True,          # False sur un serveur de test : tout le site passe en noindex
    # Icônes (chemins dans /static/). Voir {% seo_icones %} et la route /favicon.ico.
    # Bilingue. Deux façons :
    #   {'fr': '', 'en': ''}                                   → mêmes domaine, préfixes /fr/ /en/ (i18n_patterns de Django)
    #   {'fr': 'https://www.site.com', 'en': 'https://en.site.com'} → un domaine par langue, mêmes chemins
    'LANGUES': {},
    'LANGUE_DEFAUT': 'fr',           # version proposée aux autres langues (x-default)
    'REGIONS': {'fr': 'fr_CM', 'en': 'en_CM'},
    'INDEXNOW': {},                  # {'CLE': '…32 caractères hexadécimaux…'} — voir indexnow.py
    'ICONES': {
        'ICO': '',            # favicon.ico (48 × 48, peut contenir aussi 16 et 32) : onglets, anciens navigateurs
        'SVG': '',            # favicon.svg : net à toutes les tailles (navigateurs récents)
        'PNG': '',            # icone-192.png (192 × 192) : Android, et icône affichée par Google
        'APPLE': '',          # apple-touch-icon.png (180 × 180, fond plein, sans transparence) : iPhone, iPad
        'MANIFESTE': '',      # manifest.webmanifest, si le site en a un (PWA d'OperaPlus)
        'COULEUR': '',        # couleur de la barre du navigateur sur mobile, ex. '#123A37'
    },
}


def reglage(cle):
    return getattr(settings, 'REFERENCEMENT', {}).get(cle, DEFAUTS[cle])


def absolue(chemin):
    """Transforme « /static/x.jpg » en « https://site/static/x.jpg » (laisse les URL complètes intactes)."""
    if not chemin:
        return ''
    chemin = str(chemin)
    if chemin.startswith(('http://', 'https://')):
        return chemin
    return reglage('URL').rstrip('/') + '/' + chemin.lstrip('/')


# Fichiers techniques jamais marqués noindex (robots.txt, sitemaps, flux, favicon, clé IndexNow)
_TECHNIQUES = ('.xml', '.txt', '.ico', '.webmanifest', '.js')


def est_public(chemin):
    for p in reglage('PUBLIC'):
        if p.endswith('*'):
            if chemin.startswith(p[:-1]):
                return True
        elif chemin == p:
            return True
    return False


def est_prive(chemin):
    if any(chemin.startswith(p) for p in reglage('PRIVE')):
        return True
    if reglage('PUBLIC') and not chemin.endswith(_TECHNIQUES):
        return not est_public(chemin)
    return False


def langue_courante():
    from django.utils import translation
    langue = (translation.get_language() or reglage('LANGUE')).split('-')[0]
    return langue if not reglage('LANGUES') or langue in reglage('LANGUES') else reglage('LANGUE')


def region(langue=None):
    langue = langue or langue_courante()
    return (reglage('REGIONS') or {}).get(langue) or (reglage('REGION') if langue == reglage('LANGUE') else langue)


def alternatives(chemin, objet=None):
    """{'fr': 'https://…', 'en': 'https://…', 'x-default': 'https://…'} pour la page, ou {} si le site n'est pas multilingue.
    Un objet peut définir traductions() → {'fr': objet_fr, 'en': objet_en} (ou des chemins) : seules les langues
    réellement traduites sont alors déclarées (jamais de lien vers une page qui n'existe pas)."""
    langues = reglage('LANGUES') or {}
    if len(langues) < 2:
        return {}
    sortie = {}
    if objet is not None and hasattr(objet, 'traductions'):
        for code, cible in (objet.traductions() or {}).items():
            if cible is not None and code in langues:
                p = cible if isinstance(cible, str) else cible.get_absolute_url()
                sortie[code] = (langues[code].rstrip('/') + p) if langues[code].startswith('http') else absolue(p)
    else:
        from django.urls import translate_url
        for code, domaine in langues.items():
            if domaine.startswith('http'):
                sortie[code] = domaine.rstrip('/') + chemin
            else:
                traduit = translate_url(chemin, code)
                if traduit == chemin:                 # route sans nom (name=…) : on remplace le préfixe de langue
                    traduit = _changer_prefixe(chemin, code, langues)
                sortie[code] = absolue(traduit)
        if len(set(sortie.values())) < 2:           # traduction d'URL impossible : ne rien déclarer plutôt que du faux
            return {}
    if len(sortie) >= 2 and reglage('LANGUE_DEFAUT') in sortie:
        sortie['x-default'] = sortie[reglage('LANGUE_DEFAUT')]
    return sortie if len(sortie) >= 2 else {}


def _changer_prefixe(chemin, code, langues):
    """/fr/debats/ → /en/debats/ ; sans préfixe (langue par défaut non préfixée) : /debats/ → /en/debats/."""
    morceaux = chemin.split('/', 2)
    if len(morceaux) > 1 and morceaux[1] in langues:
        reste = morceaux[2] if len(morceaux) > 2 else ''
        if code == reglage('LANGUE_DEFAUT') and not _defaut_prefixee():
            return '/' + reste
        return '/%s/%s' % (code, reste)
    if code == reglage('LANGUE_DEFAUT') and not _defaut_prefixee():
        return chemin
    return '/' + code + chemin


def _defaut_prefixee():
    """La langue par défaut a-t-elle un préfixe (/fr/) ? Détecté depuis les URL du projet."""
    from django.urls import get_resolver
    from django.urls.resolvers import LocalePrefixPattern
    for motif in get_resolver().url_patterns:
        if isinstance(getattr(motif, 'pattern', None), LocalePrefixPattern):
            return motif.pattern.prefix_default_language
    return False                          # pas d'i18n_patterns : la langue par défaut n'a pas de préfixe
