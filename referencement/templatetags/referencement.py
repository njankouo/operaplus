"""Balises de référencement.

Dans le <head> du gabarit de base :
    {% load referencement %}<html lang="{% seo_langue %}"> … {% seo_icones %} {% block seo %}{% seo %}{% endblock %}

Selon la page :
    {% seo titre="…" description="…" image=… type="article" objet=actualite %}   balises + hreflang + RSS
    {% seo_article actualite %}            données structurées NewsArticle (auteur relié à sa page)
    {% seo_ariane "Accueil" "/" … %}       fil d'Ariane
    {% seo_auteur auteur %}                page auteur (ProfilePage + Person)
    {% seo_evenement evenement %}          agenda (Event)
    {% seo_faq … %}  {% seo_logiciel … %}
    {% articles_lies actualite 3 %}        bloc « À lire aussi » (maillage interne)
"""
import json

from django import template
from django.apps import apps
from django.templatetags.static import static
from django.utils.html import format_html, strip_tags
from django.utils.safestring import mark_safe
from django.utils.text import Truncator

from ..conf import absolue, alternatives, est_prive, langue_courante, region, reglage

register = template.Library()


# ----------------------------------------------------------------- outils
def _court(texte, n):
    texte = ' '.join(strip_tags(str(texte or '')).split())
    return Truncator(texte).chars(n, truncate='…')


def _jsonld(donnees):
    # « </ » est échappé pour qu'un titre ne puisse pas fermer la balise <script>
    return mark_safe('<script type="application/ld+json">%s</script>'
                     % json.dumps(donnees, ensure_ascii=False, default=str).replace('</', '<\\/'))


def _attr(obj, *noms):
    for n in noms:
        v = getattr(obj, n, None)
        if callable(v) and not hasattr(v, 'url') and not hasattr(v, 'all'):
            v = v()
        if v:
            return v
    return None


def _url_fichier(f):
    try:
        return absolue(f.url) if f else ''
    except (ValueError, AttributeError):
        return absolue(f) if isinstance(f, str) else ''


def _organisation():
    org = {'@type': reglage('TYPE_ORGANISATION'), 'name': reglage('NOM'), 'url': reglage('URL') + '/'}
    if reglage('LOGO'):
        org['logo'] = {'@type': 'ImageObject', 'url': absolue(reglage('LOGO'))}
    if reglage('RESEAUX'):
        org['sameAs'] = list(reglage('RESEAUX'))
    return org


def _personne(auteur):
    """Une personne pour schema.org, à partir d'un texte ou d'un objet (nom, fonction, photo, page, réseaux)."""
    if not auteur:
        return None
    if isinstance(auteur, str):
        return {'@type': 'Person', 'name': auteur}
    p = {'@type': 'Person', 'name': str(_attr(auteur, 'nom_complet', 'get_full_name', 'nom', 'name') or auteur)}
    if hasattr(auteur, 'get_absolute_url'):
        p['url'] = absolue(auteur.get_absolute_url())
    fonction = _attr(auteur, 'fonction', 'titre', 'job_title', 'poste')
    if fonction:
        p['jobTitle'] = str(fonction)
    photo = _attr(auteur, 'photo', 'image', 'avatar')
    if photo:
        p['image'] = _url_fichier(photo)
    bio = _attr(auteur, 'biographie', 'bio', 'presentation', 'description')
    if bio:
        p['description'] = _court(bio, 300)
    liens = [l for l in (_attr(auteur, 'linkedin'), _attr(auteur, 'twitter'), _attr(auteur, 'site_web')) if l]
    if liens:
        p['sameAs'] = liens
    p['worksFor'] = {'@type': reglage('TYPE_ORGANISATION'), 'name': reglage('NOM')}
    return p


def _a_un_flux():
    return any(c.get('flux') for c in reglage('SITEMAPS').values())


# ----------------------------------------------------------------- <head>
@register.inclusion_tag('referencement/balises.html', takes_context=True)
def seo(context, titre='', description='', image='', type='website', canonique='', indexer=True,
        date_publication=None, date_modification=None, auteur='', objet=None,
        titre_exact='', titre_partage='', locale='', robots=''):
    """titre_exact : titre complet utilisé tel quel (sans « · Nom du site ») ; titre_partage : titre des aperçus de partage ;
    locale : og:locale imposé (ex. en_US) ; robots : texte d'un ancien bloc robots (« noindex » y est respecté)."""
    robots_force = robots
    request = context.get('request')
    chemin = request.path if request else '/'
    nom = reglage('NOM')
    titre_exact = ' '.join(str(titre_exact or '').split())
    titre_complet = _court(titre_exact, 70) if titre_exact else (_court(titre, 60) + reglage('SEPARATEUR') + nom) if titre and titre != nom else nom
    desc = _court(description or reglage('DESCRIPTION'), 158)
    url = absolue(canonique or chemin)
    robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    if not indexer or not reglage('INDEXER') or est_prive(chemin) or 'noindex' in str(robots_force).lower():
        robots = 'noindex, nofollow'
    langue = (getattr(objet, 'langue', None) if objet is not None else None) or langue_courante()
    alts = alternatives(chemin, objet) if robots.startswith('index') else {}

    blocs = []
    if chemin == '/' or (len(reglage('LANGUES') or {}) > 1 and chemin.strip('/') in reglage('LANGUES')):
        site = {'@context': 'https://schema.org', '@type': 'WebSite', 'name': nom, 'url': reglage('URL') + '/',
                'inLanguage': list(reglage('LANGUES')) or reglage('LANGUE'), 'publisher': _organisation()}
        if reglage('RECHERCHE'):
            site['potentialAction'] = {'@type': 'SearchAction', 'target': absolue(reglage('RECHERCHE')),
                                       'query-input': 'required name=search_term_string'}
        blocs.append(_jsonld(site))
        org = _organisation(); org['@context'] = 'https://schema.org'
        if reglage('SITES_LIES'):
            org['subOrganization'] = [{'@type': 'Organization', 'name': s['nom'], 'url': s['url']} for s in reglage('SITES_LIES')]
        blocs.append(_jsonld(org))

    return {
        'titre': titre_complet, 'description': desc, 'url': url, 'robots': robots, 'type': type,
        'image': (_url_fichier(image) if not isinstance(image, str) else absolue(image.strip())) if image and str(image).strip() else absolue(reglage('IMAGE')), 'nom': nom,
        'region': ' '.join(str(locale).split()) or region(langue), 'regions_alt': [region(c) for c in alts if c not in ('x-default', langue)],
        'twitter': reglage('TWITTER'), 'titre_court': _court(' '.join(str(titre_partage or '').split()) or titre or titre_exact or nom, 90),
        'date_publication': date_publication, 'date_modification': date_modification, 'auteur': auteur,
        'alternatives': alts, 'flux': absolue('/flux.xml') if _a_un_flux() else '',
        'jsonld': mark_safe(''.join(blocs)),
    }


@register.simple_tag
def seo_langue():
    """<html lang="{% seo_langue %}"> : suit la langue active sur un site bilingue."""
    return langue_courante()


@register.simple_tag
def seo_icones():
    """Icônes du site, dans le <head> de TOUTES les pages : {% seo_icones %}"""
    i = dict(reglage('ICONES') or {})
    src = lambda p: p if str(p).startswith(('http://', 'https://', '/')) else static(p)
    lignes = []
    if i.get('ICO'):
        lignes.append(format_html('<link rel="icon" href="{}" sizes="48x48">', src(i['ICO'])))
    if i.get('SVG'):
        lignes.append(format_html('<link rel="icon" href="{}" type="image/svg+xml">', src(i['SVG'])))
    if i.get('PNG'):
        lignes.append(format_html('<link rel="icon" href="{}" type="image/png" sizes="192x192">', src(i['PNG'])))
    if i.get('APPLE'):
        lignes.append(format_html('<link rel="apple-touch-icon" href="{}">', src(i['APPLE'])))
    if i.get('MANIFESTE'):
        lignes.append(format_html('<link rel="manifest" href="{}">', src(i['MANIFESTE'])))
    if i.get('COULEUR'):
        lignes.append(format_html('<meta name="theme-color" content="{}">', i['COULEUR']))
    return mark_safe('\n'.join(lignes))


# ----------------------------------------------------------------- données structurées
@register.simple_tag(takes_context=True)
def seo_article(context, objet, type_article='NewsArticle'):
    """Article, débat, dépêche… Lit les attributs usuels : titre, chapeau/resume/contenu, image,
    date_publication, date_modification, auteur (texte ou objet avec sa page), mots_cles, rubrique."""
    titre = _attr(objet, 'titre', 'title', 'nom', 'name')
    resume = _attr(objet, 'chapeau', 'resume', 'description', 'extrait', 'contenu', 'texte', 'content')
    image = _attr(objet, 'image', 'photo', 'illustration', 'couverture')
    publie = _attr(objet, 'date_publication', 'date_pub', 'date_creation', 'created_at', 'date')
    modifie = _attr(objet, 'date_modification', 'updated_at', 'modifie_le') or publie
    auteur = _attr(objet, 'auteur', 'author', 'redacteur')
    rubrique = _attr(objet, 'rubrique', 'categorie', 'section')
    mots = _attr(objet, 'mots_cles', 'tags', 'keywords')
    url = absolue(objet.get_absolute_url()) if hasattr(objet, 'get_absolute_url') else absolue(context['request'].path)
    d = {'@context': 'https://schema.org', '@type': type_article, 'headline': _court(titre, 110),
         'mainEntityOfPage': {'@type': 'WebPage', '@id': url}, 'url': url,
         'inLanguage': getattr(objet, 'langue', None) or langue_courante(), 'publisher': _organisation(),
         'isAccessibleForFree': True}
    if resume:
        d['description'] = _court(resume, 300)
    if image:
        d['image'] = [_url_fichier(image)]
    if publie:
        d['datePublished'] = publie.isoformat()
    if modifie:
        d['dateModified'] = modifie.isoformat()
    d['author'] = [_personne(auteur)] if auteur else [{'@type': 'Organization', 'name': reglage('NOM'), 'url': reglage('URL') + '/'}]
    if rubrique:
        d['articleSection'] = str(rubrique)
    if mots:
        d['keywords'] = ', '.join(str(m) for m in (mots.all() if hasattr(mots, 'all') else ([mots] if isinstance(mots, str) else mots)))
    contenu = _attr(objet, 'contenu', 'texte', 'content', 'corps')
    if contenu:
        d['wordCount'] = len(strip_tags(str(contenu)).split())
    return _jsonld(d)


@register.simple_tag(takes_context=True)
def seo_auteur(context, auteur):
    """Page d'un auteur : {% seo_auteur auteur %} (avec {% seo titre=auteur.nom type="profile" %})."""
    p = _personne(auteur) or {}
    p.setdefault('url', absolue(context['request'].path))
    return _jsonld({'@context': 'https://schema.org', '@type': 'ProfilePage', 'mainEntity': p})


@register.simple_tag(takes_context=True)
def seo_evenement(context, ev):
    """Agenda : lit titre, description, date_debut/date_fin (ou debut/fin), lieu/ville/pays, en_ligne, lien, image, organisateur."""
    debut = _attr(ev, 'date_debut', 'debut', 'date')
    fin = _attr(ev, 'date_fin', 'fin') or debut
    en_ligne = bool(_attr(ev, 'en_ligne', 'online', 'virtuel'))
    lieu_nom = _attr(ev, 'lieu', 'salle', 'adresse')
    ville, pays = _attr(ev, 'ville'), _attr(ev, 'pays')
    url = absolue(ev.get_absolute_url()) if hasattr(ev, 'get_absolute_url') else absolue(context['request'].path)
    d = {'@context': 'https://schema.org', '@type': 'Event', 'name': _court(_attr(ev, 'titre', 'nom', 'name'), 110),
         'startDate': debut.isoformat() if debut else None, 'endDate': fin.isoformat() if fin else None,
         'eventStatus': 'https://schema.org/EventScheduled', 'url': url,
         'eventAttendanceMode': 'https://schema.org/%sEventAttendanceMode' % ('Online' if en_ligne and not lieu_nom else 'Mixed' if en_ligne else 'Offline'),
         'organizer': {'@type': 'Organization', 'name': str(_attr(ev, 'organisateur') or reglage('NOM')), 'url': reglage('URL') + '/'}}
    lieux = []
    if lieu_nom or ville:
        lieux.append({'@type': 'Place', 'name': str(lieu_nom or ville),
                      'address': {'@type': 'PostalAddress', 'addressLocality': str(ville or ''), 'addressCountry': str(pays or '')}})
    if en_ligne:
        lieux.append({'@type': 'VirtualLocation', 'url': str(_attr(ev, 'lien', 'lien_visio', 'url_en_ligne') or url)})
    if lieux:
        d['location'] = lieux if len(lieux) > 1 else lieux[0]
    desc = _attr(ev, 'description', 'resume', 'contenu')
    if desc:
        d['description'] = _court(desc, 300)
    img = _attr(ev, 'image', 'affiche', 'photo')
    if img:
        d['image'] = [_url_fichier(img)]
    return _jsonld({k: v for k, v in d.items() if v})


@register.simple_tag
def seo_ariane(*elements):
    """{% seo_ariane "Accueil" "/" "Débats" "/debats/" "Titre de la page" %} : paires nom / lien, le dernier sans lien."""
    items, i, pos = [], 0, 1
    while i < len(elements):
        nom = elements[i]; lien = elements[i + 1] if i + 1 < len(elements) else None
        item = {'@type': 'ListItem', 'position': pos, 'name': _court(nom, 80)}
        if lien:
            item['item'] = absolue(lien)
        items.append(item); i += 2; pos += 1
    return _jsonld({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': items})


@register.simple_tag
def seo_faq(*paires):
    """{% seo_faq "Question 1 ?" "Réponse 1" "Question 2 ?" "Réponse 2" %} (le texte doit aussi être visible sur la page)"""
    q = [{'@type': 'Question', 'name': _court(paires[i], 200),
          'acceptedAnswer': {'@type': 'Answer', 'text': _court(paires[i + 1], 1000)}} for i in range(0, len(paires) - 1, 2)]
    return _jsonld({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': q})


@register.simple_tag
def seo_logiciel(nom, description, url='', categorie='BusinessApplication', prix='0', devise='XAF',
                 systemes='Web, Android', sous_categorie=''):
    """Page publique d'OperaPlus : {% seo_logiciel "OperaPlus" "Plateforme de suivi-évaluation…" %}"""
    d = {'@context': 'https://schema.org', '@type': 'SoftwareApplication', 'name': nom, 'description': _court(description, 300),
         'applicationCategory': categorie, 'operatingSystem': systemes, 'url': absolue(url or '/'),
         'inLanguage': list(reglage('LANGUES')) or reglage('LANGUE'),
         'offers': {'@type': 'Offer', 'price': str(prix), 'priceCurrency': devise}, 'publisher': _organisation()}
    if sous_categorie:
        d['applicationSubCategory'] = sous_categorie
    return _jsonld(d)


# ----------------------------------------------------------------- maillage interne
def _conf_de(objet):
    nom = '%s.%s' % (objet._meta.app_label, objet._meta.object_name)
    for conf in reglage('SITEMAPS').values():
        if conf.get('modele', '').lower() == nom.lower():
            return conf
    return {}


@register.inclusion_tag('referencement/articles_lies.html')
def articles_lies(objet, nombre=3, titre='À lire aussi'):
    """« À lire aussi » : d'abord les contenus publiés de la même rubrique (réglage « lies »), puis les plus récents.
    Même langue que l'objet sur un site bilingue. Utilise le gabarit referencement/articles_lies.html (à surcharger)."""
    conf = _conf_de(objet)
    modele = type(objet)
    qs = modele._default_manager.filter(**conf.get('filtre', {})).exclude(pk=objet.pk)
    if conf.get('langue'):
        qs = qs.filter(**{conf['langue']: getattr(objet, conf['langue'], None)})
    ordre = ('-' + conf['date']) if conf.get('date') else '-pk'
    trouves = []
    champ = conf.get('lies')
    if champ:
        valeur = getattr(objet, champ + '_id', None) if hasattr(objet, champ + '_id') else getattr(objet, champ, None)
        if valeur is not None:
            filtre = {champ + '_id': valeur} if hasattr(objet, champ + '_id') else {champ: valeur}
            trouves = list(qs.filter(**filtre).order_by(ordre)[:nombre])
    if len(trouves) < nombre:
        trouves += list(qs.exclude(pk__in=[o.pk for o in trouves]).order_by(ordre)[:nombre - len(trouves)])
    image_champ = conf.get('image')
    elements = [{'objet': o, 'url': o.get_absolute_url(), 'titre': str(_attr(o, conf.get('titre', 'titre'), 'titre', 'title', 'nom') or o),
                 'resume': _court(_attr(o, 'chapeau', 'resume', 'description'), 140),
                 'image': _url_fichier(getattr(o, image_champ, None)) if image_champ else '',
                 'date': getattr(o, conf['date'], None) if conf.get('date') else None} for o in trouves]
    return {'elements': elements, 'titre': titre}


# ----------------------------------------------------------------- reprise d'anciens blocs
class _CaptureNode(template.Node):
    child_nodelists = ('nodelist',)          # indispensable : les {% block %} à l'intérieur restent surchargeables

    def __init__(self, nom, nodelist):
        self.nom, self.nodelist = nom, nodelist

    def render(self, context):
        context[self.nom] = ' '.join(self.nodelist.render(context).split())
        return ''


@register.tag('seo_capture')
def seo_capture(parser, token):
    """Garde les blocs de tes pages enfants et donne leur contenu à {% seo %}, sans rien afficher :

        {% seo_capture "seo_titre" %}{% block title %}Titre par défaut{% endblock %}{% fin_seo_capture %}
        {% seo titre_exact=seo_titre %}
    """
    morceaux = token.split_contents()
    if len(morceaux) != 2:
        raise template.TemplateSyntaxError('Usage : {% seo_capture "nom_de_variable" %}…{% fin_seo_capture %}')
    nodelist = parser.parse(('fin_seo_capture',))
    parser.delete_first_token()
    return _CaptureNode(morceaux[1].strip('"\''), nodelist)
