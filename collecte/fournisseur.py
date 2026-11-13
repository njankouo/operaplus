"""
Liste des tâches (échéances à déclarer) envoyée au téléphone pour le travail hors ligne.

Par défaut : les échéances (IndicateurValeur) non encore déclarées des opérations dont
l'utilisateur est responsable (Operation.personnel). Pour une autre règle :
    COLLECTE_FOURNISSEUR_TACHES = 'mon_app.module.ma_fonction'   # ma_fonction(request) -> liste de dict
Chaque dict : echeance_id, operation_id, operation_nom, tache_nom, niveau_actuel, date_echeance (AAAA-MM-JJ), ponderation
"""
import logging

from django.apps import apps
from django.conf import settings
from django.utils.module_loading import import_string

log = logging.getLogger(__name__)


def _modele(nom):
    for m in apps.get_models():
        if m.__name__ == nom:
            return m
    return None


def _iso(v):
    try:
        return v.date().isoformat() if hasattr(v, 'date') and callable(v.date) else v.isoformat()
    except Exception:
        return ''


def taches_par_defaut(request):
    IV = _modele('IndicateurValeur')
    perso = getattr(request.user, 'personnel', None)
    if IV is None or perso is None:
        return []
    noms = {f.name for f in IV._meta.get_fields()}
    qs = IV.objects.filter(operation__isnull=False, operation__personnel=perso)
    if 'etat' in noms:
        qs = qs.filter(etat=False)
    qs = qs.select_related('operation')
    taches = []
    for iv in qs[:400]:
        op = iv.operation
        tache = getattr(op, 'tache', None)
        taches.append({
            'echeance_id': iv.pk,
            'operation_id': op.pk,
            'operation_nom': getattr(op, 'nom', '') or 'Opération %s' % op.pk,
            'tache_nom': getattr(tache, 'm_nom', '') or getattr(tache, 'nom', '') or '',
            'niveau_actuel': float(getattr(op, 'niveau_execution', 0) or 0),
            'date_echeance': _iso(getattr(op, 'date_echeance', None) or getattr(iv, 'date_enregistrement', None)) if (getattr(op, 'date_echeance', None) or getattr(iv, 'date_enregistrement', None)) else '',
            'ponderation': float(getattr(op, 'ponderation', 0) or 0),
        })
    taches.sort(key=lambda t: t['date_echeance'] or '9999')
    return taches


def taches(request):
    chemin = getattr(settings, 'COLLECTE_FOURNISSEUR_TACHES', None)
    try:
        return (import_string(chemin) if chemin else taches_par_defaut)(request)
    except Exception:
        log.exception('collecte : impossible de lister les tâches')
        return []
