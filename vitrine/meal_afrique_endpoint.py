"""
À INSTALLER DANS LE PROJET MEAL AFRIQUE (pas dans OperaPlus) — uniquement si les deux sites
n'utilisent PAS la même base de données.

Expose des TOTAUX publics (aucune donnée personnelle) que la vitrine OperaPlus affiche
dans le badge « Membre MEAL Afrique ». Adaptez les noms des modèles.

urls.py (MEAL Afrique) :
    from .meal_afrique_endpoint import stats_publiques
    path("api/stats-publiques/", stats_publiques),

settings.py (OperaPlus) :
    MEAL_AFRIQUE_STATS_URL = "https://adresse-de-meal-afrique/api/stats-publiques/"
"""
from django.http import JsonResponse
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET


@require_GET
@cache_page(60 * 30)
def stats_publiques(request):
    from django.apps import apps

    def compte(chemin, **filtre):
        try:
            return apps.get_model(chemin)._default_manager.filter(**filtre).count()
        except Exception:
            return None

    data = {
        "membres": compte("auth.User", is_active=True),
        # Remplacez par vos modèles réels :
        # "experts": compte("journal.ProfilExpert"),
        # "debats": compte("journal.Debat", publie=True),
        # "articles": compte("journal.Actualite", publie=True),
    }
    reponse = JsonResponse({k: v for k, v in data.items() if v is not None})
    reponse["Access-Control-Allow-Origin"] = "*"      # lecture seule, totaux publics
    return reponse
