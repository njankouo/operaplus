"""Balises du site vitrine : partenaires, témoignages, actualités MEAL Afrique,
jeton du formulaire, badge membre. Lecture seule, mises en cache, sans risque de plantage."""
import logging
import urllib.request
from xml.etree import ElementTree

from django import template
from django.conf import settings
from django.core.cache import cache
from django.utils.html import strip_tags

from ..forms import jeton_formulaire
from ..data import FONCTIONNALITES

register = template.Library()
log = logging.getLogger(__name__)


@register.simple_tag
def vitrine_partenaires():
    from ..models import Partenaire
    try:
        return list(Partenaire.objects.filter(accord_affichage=True)[:12])
    except Exception:
        log.exception("vitrine : partenaires indisponibles")
        return []


@register.simple_tag
def vitrine_temoignages():
    from ..models import Temoignage
    try:
        return list(Temoignage.objects.filter(publie=True, accord_publication=True)[:3])
    except Exception:
        log.exception("vitrine : témoignages indisponibles")
        return []


@register.simple_tag
def vitrine_jeton():
    return jeton_formulaire()


@register.simple_tag
def vitrine_fonctionnalites():
    return FONCTIONNALITES


@register.simple_tag
def meal_afrique_actus(nombre=3):
    """Dernières publications de MEAL Afrique, depuis le flux RSS du journal.
    Réglage : MEAL_AFRIQUE_RSS = "https://…/rss/" (absent -> section masquée)."""
    url = getattr(settings, "MEAL_AFRIQUE_RSS", "")
    if not url.startswith("https://"):
        return []
    cle = "vitrine_meal_actus"
    actus = cache.get(cle)
    if actus is not None:
        return actus[:nombre]
    actus = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "OperaPlus-vitrine/1.0"})
        with urllib.request.urlopen(req, timeout=3) as r:          # délai court : la page n'attend jamais
            brut = r.read(512 * 1024)                              # 512 Ko maximum
        if b"<!ENTITY" in brut or b"<!DOCTYPE" in brut:           # refuse les entités XML (attaques XXE)
            raise ValueError("flux refusé")
        racine = ElementTree.fromstring(brut)
        for it in racine.iter("item"):
            titre = strip_tags(it.findtext("title") or "").strip()[:140]
            lien = (it.findtext("link") or "").strip()
            if titre and lien.startswith("https://"):
                actus.append({"titre": titre, "lien": lien,
                              "categorie": strip_tags(it.findtext("category") or "Actualité")[:40],
                              "date": (it.findtext("pubDate") or "")[:16]})
            if len(actus) >= 6:
                break
    except Exception:
        log.warning("vitrine : flux MEAL Afrique indisponible", exc_info=True)
    cache.set(cle, actus, 60 * 30 if actus else 60 * 5)
    return actus[:nombre]


@register.filter
def est_membre_meal(user):
    """{% if request.user|est_membre_meal %} … badge … {% endif %}"""
    try:
        return bool(user and user.is_authenticated and hasattr(user, "membre_meal_afrique"))
    except Exception:
        return False
