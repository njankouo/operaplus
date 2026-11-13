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


# ---------------------------------------------------------------- matrice RACI
"""
Opérations où l'utilisateur est Accountable, Consulted ou Informed (R = échéances ci-dessus).
Les champs sont détectés sur le modèle Operation (clé étrangère ou plusieurs-à-plusieurs,
vers Personnel ou vers User). Pour forcer les noms :
    COLLECTE_CHAMPS_RACI = {'R': 'personnel', 'A': 'accountable', 'C': 'consulted', 'I': 'informed'}
"""
CANDIDATS = {
    'R': ['personnel', 'responsable', 'responsible', 'r'],
    'A': ['accountable', 'approbateur', 'redevable', 'a'],
    'C': ['consulted', 'consulte', 'consultes', 'consulted_personnel', 'c'],
    'I': ['informed', 'informe', 'informes', 'informed_personnel', 'i'],
}


def _champ_role(Op, role):
    force = getattr(settings, 'COLLECTE_CHAMPS_RACI', {}).get(role)
    noms = [force] if force else CANDIDATS[role]
    champs = {f.name: f for f in Op._meta.get_fields() if getattr(f, 'is_relation', False) and (f.many_to_one or f.many_to_many) and not f.auto_created}
    for n in noms:
        if n in champs:
            return champs[n]
    return None


def _nom(x):
    if x is None:
        return ''
    if hasattr(x, 'all'):
        return ', '.join(str(p) for p in x.all()[:3])
    return str(x)


def operations_role(request, role):
    Op = _modele('Operation')
    perso = getattr(request.user, 'personnel', None)
    if Op is None:
        return []
    f = _champ_role(Op, role)
    if f is None:
        return []
    cible = request.user if f.related_model is request.user.__class__ else perso
    if cible is None:
        return []
    qs = Op.objects.filter(**{f.name: cible}).distinct()
    fr = _champ_role(Op, 'R')
    rel = ['tache'] if 'tache' in {x.name for x in Op._meta.fields} else []
    if fr is not None and fr.many_to_one:
        rel.append(fr.name)
    qs = qs.select_related(*rel)
    IV = _modele('IndicateurValeur')
    attente = {}
    if IV is not None and 'etat' in {x.name for x in IV._meta.get_fields()}:
        from django.db.models import Count
        for ligne in IV.objects.filter(operation__in=qs, etat=False).values('operation').annotate(n=Count('id')):
            attente[ligne['operation']] = ligne['n']
    res = []
    for op in qs[:300]:
        tache = getattr(op, 'tache', None)
        ech = getattr(op, 'date_echeance', None)
        res.append({
            'operation_id': op.pk,
            'operation_nom': getattr(op, 'nom', '') or 'Opération %s' % op.pk,
            'tache_nom': getattr(tache, 'm_nom', '') or getattr(tache, 'nom', '') or '',
            'niveau_actuel': float(getattr(op, 'niveau_execution', 0) or 0),
            'date_echeance': _iso(ech) if ech else '',
            'responsable': _nom(getattr(op, fr.name, None)) if fr is not None else '',
            'echeances_attente': attente.get(op.pk, 0),
        })
    res.sort(key=lambda t: t['date_echeance'] or '9999')
    return res


def raci(request):
    chemin = getattr(settings, 'COLLECTE_FOURNISSEUR_RACI', None)
    try:
        if chemin:
            return import_string(chemin)(request)
        return {r: operations_role(request, r) for r in ('A', 'C', 'I')}
    except Exception:
        log.exception('collecte : impossible de lister la matrice RACI')
        return {'A': [], 'C': [], 'I': []}
