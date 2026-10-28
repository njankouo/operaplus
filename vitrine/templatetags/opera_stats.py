"""
Chiffres publics de la page d'accueil OperaPlus.

- Aucune modification de views.py : c'est une balise de gabarit.
- Sécurisé : uniquement des COMPTAGES agrégés (aucun nom, aucune donnée
  personnelle), en lecture seule, sans paramètre venant du visiteur.
- Léger : calculé au plus une fois toutes les 15 minutes (cache Django).
- Robuste : si un modèle n'existe pas ou qu'une requête échoue, le chiffre
  est simplement masqué ; la page ne plante jamais.

Utilisation dans le gabarit :
    {% load opera_stats %}
    {% opera_stats as st %}
    {{ st.projets.display }}

Réglages facultatifs (settings.py) :
    OPERA_STATS_MODELS = {               # si vos modèles portent d'autres noms
        "projets": "votre_app.Institution",
        "indicateurs": "votre_app.Indicateur",
        "formulaires": "votre_app.Dataset",
        "activites": "votre_app.Operation",
        "membres": "votre_app.Personnel",
    }
    OPERA_STATS_PROJETS_FILTRE = {"is_active": False}   # même filtre que votre vue index
    OPERA_STATS_SEUIL = 5        # en dessous, le chiffre n'est pas affiché
    OPERA_STATS_CACHE = 900      # durée du cache en secondes
"""
import logging

from django import template
from django.apps import apps
from django.conf import settings
from django.core.cache import cache

register = template.Library()
log = logging.getLogger(__name__)

# Noms de modèles essayés automatiquement (le premier trouvé est utilisé)
CANDIDATS = {
    "projets": ["Institution"],
    "indicateurs": ["Indicateur", "Indicator", "Indicateurs", "DataElement"],
    "formulaires": ["Dataset", "DataSet", "Formulaire"],
    "activites": ["Operation", "Activite", "Activity"],
    "membres": ["Personnel"],
}

LIBELLES = {
    "projets": "projets suivis",
    "indicateurs": "indicateurs suivis",
    "formulaires": "formulaires de collecte",
    "activites": "activités planifiées",
    "membres": "professionnels inscrits",
    "pays": "pays représentés",
}

ORDRE = ["projets", "indicateurs", "formulaires", "activites", "pays", "membres"]


def _modele(cle):
    """Retrouve le modèle : d'abord le réglage, sinon par son nom."""
    choisi = getattr(settings, "OPERA_STATS_MODELS", {}).get(cle)
    if choisi:
        try:
            return apps.get_model(choisi)
        except (LookupError, ValueError):
            log.warning("opera_stats : modèle %s introuvable", choisi)
            return None
    noms = {n.lower() for n in CANDIDATS.get(cle, [])}
    for m in apps.get_models():
        if m.__name__.lower() in noms and not m._meta.abstract:
            return m
    return None


def _arrondi(n):
    """Affichage honnête et discret : 1 234 -> « 1 200+ », 87 -> « 85+ », 12 -> « 12 »."""
    if n >= 1000:
        return f"{(n // 100) * 100:,}".replace(",", " ") + "+", (n // 100) * 100
    if n >= 100:
        return f"{(n // 10) * 10}+", (n // 10) * 10
    if n >= 20:
        return f"{(n // 5) * 5}+", (n // 5) * 5
    return str(n), n


def _calcul():
    resultats = {}

    for cle in ["projets", "indicateurs", "formulaires", "activites", "membres"]:
        modele = _modele(cle)
        if modele is None:
            continue
        try:
            qs = modele._default_manager.all()
            if cle == "projets":
                filtre = getattr(settings, "OPERA_STATS_PROJETS_FILTRE", {"is_active": False})
                if filtre:
                    qs = qs.filter(**filtre)
            resultats[cle] = qs.count()
        except Exception:  # base indisponible, champ absent… : on masque ce chiffre
            log.exception("opera_stats : comptage impossible pour %s", cle)

    # Pays distincts (champ « country » de Personnel, comme dans votre vue)
    membres = _modele("membres")
    if membres is not None:
        try:
            resultats["pays"] = (
                membres._default_manager.exclude(country__isnull=True)
                .exclude(country="").values("country").distinct().count()
            )
        except Exception:
            log.exception("opera_stats : comptage des pays impossible")

    seuil = getattr(settings, "OPERA_STATS_SEUIL", 5)
    sortie = {}
    for cle in ORDRE:
        n = resultats.get(cle)
        if n is None or n < seuil:
            continue
        texte, valeur = _arrondi(n)
        sortie[cle] = {"valeur": valeur, "display": texte, "libelle": LIBELLES[cle],
                       "plus": texte.endswith("+")}
    return sortie


@register.simple_tag
def opera_stats():
    """Renvoie {"projets": {...}, ..., "liste": [...] } — mis en cache."""
    cle_cache = "opera_stats_accueil_v1"
    donnees = cache.get(cle_cache)
    if donnees is None:
        donnees = _calcul()
        cache.set(cle_cache, donnees, getattr(settings, "OPERA_STATS_CACHE", 900))
    resultat = dict(donnees)
    resultat["liste"] = [dict(cle=k, **donnees[k]) for k in ORDRE if k in donnees]
    return resultat
