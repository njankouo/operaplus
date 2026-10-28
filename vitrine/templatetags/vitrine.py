"""Balises du site vitrine : partenaires, témoignages, actualités MEAL Afrique,
jeton du formulaire, badge membre. Lecture seule, mises en cache, sans risque de plantage."""
import json
import logging
import urllib.request
from xml.etree import ElementTree

from django import template
from django.conf import settings
from django.core.cache import cache
from django.apps import apps
from django.utils.html import strip_tags

from vitrine.forms import jeton_formulaire
from vitrine.data import FONCTIONNALITES

register = template.Library()
log = logging.getLogger(__name__)


@register.simple_tag
def vitrine_partenaires():
    from vitrine.models import Partenaire
    try:
        return list(Partenaire.objects.filter(accord_affichage=True)[:12])
    except Exception:
        log.exception("vitrine : partenaires indisponibles")
        return []


@register.simple_tag
def vitrine_temoignages():
    from vitrine.models import Temoignage
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


def _arrondi(n):
    if n >= 1000:
        return f"{(n // 100) * 100:,}".replace(",", "\u202f") + "+"
    if n >= 100:
        return f"{(n // 10) * 10}+"
    if n >= 20:
        return f"{(n // 5) * 5}+"
    return str(n)


@register.simple_tag
def meal_afrique_stats():
    """Chiffres RÉELS de la communauté MEAL Afrique, pour le badge.
    Sources (la première disponible est utilisée), tout est mis en cache 30 min :
      1. settings.MEAL_AFRIQUE_STATS_MODELS : comptage direct si MEAL Afrique partage la même base
         ex. {"membres": "journal.Expert", "debats": "journal.Debat", "articles": "journal.Actualite"}
      2. settings.MEAL_AFRIQUE_STATS_URL : adresse HTTPS qui renvoie {"membres": 1234, "debats": 56, ...}
         (voir vitrine/meal_afrique_endpoint.py à installer côté MEAL Afrique)
    En plus, toujours : le nombre de comptes OperaPlus membres de la communauté (modèle MembreMealAfrique).
    Un chiffre absent ou inférieur à 5 n'est pas affiché."""
    cle = "vitrine_meal_stats_v1"
    data = cache.get(cle)
    if data is None:
        brut = {}
        modeles = getattr(settings, "MEAL_AFRIQUE_STATS_MODELS", {})
        for k, chemin in modeles.items():
            try:
                brut[k] = apps.get_model(chemin)._default_manager.count()
            except Exception:
                log.warning("vitrine : comptage MEAL Afrique impossible pour %s", chemin, exc_info=True)
        url = getattr(settings, "MEAL_AFRIQUE_STATS_URL", "")
        if not brut and url.startswith("https://"):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "OperaPlus-vitrine/1.0", "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=3) as r:
                    j = json.loads(r.read(64 * 1024).decode("utf-8"))
                for k in ("membres", "experts", "debats", "articles", "pays", "evenements"):
                    if isinstance(j.get(k), int) and j[k] >= 0:
                        brut[k] = j[k]
            except Exception:
                log.warning("vitrine : statistiques MEAL Afrique indisponibles", exc_info=True)
        try:
            from vitrine.models import MembreMealAfrique
            brut["operaplus"] = MembreMealAfrique.objects.count()
        except Exception:
            pass
        libelles = {"membres": "membres", "experts": "experts", "debats": "débats", "articles": "articles",
                    "pays": "pays", "evenements": "événements", "operaplus": "membres OperaPlus"}
        seuil = getattr(settings, "OPERA_STATS_SEUIL", 5)
        def plancher(n):   # valeur animée = valeur arrondie affichée (jamais le chiffre exact)
            return (n // 100) * 100 if n >= 1000 else (n // 10) * 10 if n >= 100 else (n // 5) * 5 if n >= 20 else n
        data = [{"cle": k, "display": _arrondi(v), "valeur": plancher(v), "libelle": libelles[k]}
                for k, v in brut.items() if k in libelles and v >= seuil]
        cache.set(cle, data, 60 * 30)
    return data
