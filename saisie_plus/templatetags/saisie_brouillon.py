"""OperaPlus · ce qu'un brouillon contient vraiment : structure, période, nombre de valeurs, dernière saisie.

Dans le template (aucune modification de views.py) :
    {% load saisie_brouillon %}
    {% saisie_du_brouillon dataset_fom as sb %}
    {{ sb.structure }} · {{ sb.periode }} · {{ sb.nb_valeurs }} valeurs · {{ sb.derniere|date:"d/m/Y" }}
    {% for a in sb.autres %}{{ a.structure }} · {{ a.periode }} ({{ a.nb_valeurs }}){% endfor %}

Comment les valeurs du formulaire sont retrouvées (premier lien qui existe dans vos modèles) :
    1. DSet_DElt a une clé vers DataSet             → filtre direct
    2. DSet_DElt.m_dataset_value a une clé vers DataSet → filtre par la valeur de jeu de données
    3. sinon, par les éléments de données du formulaire (lien DataSet ↔ DataElement)
Même logique pour l'opération : si un lien vers Operation existe, seules les valeurs de CETTE opération comptent.
Seules les saisies manuelles comptent (comment IS NULL ; les cumuls automatiques sont ignorés).
"""
import logging

from django import template
from django.db.models import Count, F, Max

register = template.Library()
log = logging.getLogger(__name__)


def _champ_vers(modele, cible):
    """Nom du premier champ concret (clé étrangère ou plusieurs-à-plusieurs) de `modele` qui pointe vers `cible`."""
    for f in modele._meta.get_fields():
        directe = (f.many_to_one and f.concrete) or (f.many_to_many and not f.auto_created)   # pas les relations inverses
        if directe and f.related_model is cible:
            return f.name
    return None


def valeurs_du_formulaire(dso):
    """Queryset des DSet_DElt saisis à la main pour ce formulaire (et cette opération si le lien existe).
    Renvoie (queryset, filtre_par_operation)."""
    DSet_DElt = dso._meta.apps.get_model('ctn_bpf', 'DSet_DElt')
    DataSet = dso._meta.get_field('dataset').related_model
    Operation = dso._meta.get_field('operation').related_model
    DSV = DSet_DElt._meta.get_field('m_dataset_value').related_model
    qs = DSet_DElt.objects.filter(comment__isnull=True)

    # ---- formulaire
    direct, via_dsv = _champ_vers(DSet_DElt, DataSet), _champ_vers(DSV, DataSet)
    if direct:
        qs = qs.filter(**{direct: dso.dataset_id})
    elif via_dsv:
        qs = qs.filter(**{f'm_dataset_value__{via_dsv}': dso.dataset_id})
    else:
        DataElement = DSet_DElt._meta.get_field('m_dataelement').related_model
        m2m, fk = _champ_vers(DataSet, DataElement), _champ_vers(DataElement, DataSet)
        if m2m:
            ids = DataSet.objects.filter(pk=dso.dataset_id).values_list(f'{m2m}__pk', flat=True)
        elif fk:
            ids = DataElement.objects.filter(**{fk: dso.dataset_id}).values_list('pk', flat=True)
        else:
            return DSet_DElt.objects.none(), False
        qs = qs.filter(m_dataelement__in=[i for i in ids if i is not None])

    # ---- opération
    op_direct, op_dsv = _champ_vers(DSet_DElt, Operation), _champ_vers(DSV, Operation)
    if op_direct:
        return qs.filter(**{op_direct: dso.operation_id}), True
    if op_dsv:
        return qs.filter(**{f'm_dataset_value__{op_dsv}': dso.operation_id}), True
    return qs, False


def nb_elements_du_formulaire(dso):
    """Nombre d'éléments de données du formulaire (pour calculer la complétude), ou None si le lien est introuvable."""
    try:
        DSet_DElt = dso._meta.apps.get_model('ctn_bpf', 'DSet_DElt')
        DataSet = dso._meta.get_field('dataset').related_model
        DataElement = DSet_DElt._meta.get_field('m_dataelement').related_model
        m2m, fk = _champ_vers(DataSet, DataElement), _champ_vers(DataElement, DataSet)
        if m2m:
            return DataSet.objects.filter(pk=dso.dataset_id).values_list(f'{m2m}__pk', flat=True).exclude(**{f'{m2m}__pk': None}).count() or None
        if fk:
            return DataElement.objects.filter(**{fk: dso.dataset_id}).count() or None
    except Exception:
        log.exception('nb_elements_du_formulaire')
    return None


@register.simple_tag
def saisie_du_brouillon(dso, limite=6):
    """Structure et période principales (la saisie la plus récente) + les autres couples saisis."""
    vide = {'structure': None, 'periode': None, 'nb_valeurs': 0, 'derniere': None, 'autres': [], 'couples': [],
            'nb_couples': 0, 'total_valeurs': 0, 'nb_elements': None, 'completude': None,
            'nb_structures': 0, 'nb_periodes': 0, 'par_operation': False, 'trouve': False}
    if not dso:
        return vide
    try:
        qs, par_op = valeurs_du_formulaire(dso)
        couples = list(qs.values('m_structure', 'periode')
                       .annotate(nb=Count('pk'), derniere=Max('date_saisie'))
                       .order_by(F('derniere').desc(nulls_last=True), '-nb')[:max(limite, 1) + 1])
        if not couples:
            return dict(vide, par_operation=par_op)
        DSet_DElt = qs.model
        Structure = DSet_DElt._meta.get_field('m_structure').related_model
        Periode = DSet_DElt._meta.get_field('periode').related_model
        structures = Structure.objects.in_bulk({c['m_structure'] for c in couples if c['m_structure']})
        periodes = Periode.objects.in_bulk({c['periode'] for c in couples if c['periode']})
        nb_el = nb_elements_du_formulaire(dso)
        lignes = [{'structure': structures.get(c['m_structure']), 'periode': periodes.get(c['periode']),
                   'nb_valeurs': c['nb'], 'derniere': c['derniere'],
                   'completude': min(100, round(c['nb'] * 100 / nb_el)) if nb_el else None} for c in couples]
        lignes = lignes[:limite + 1]
        nb_couples = qs.values('m_structure', 'periode').distinct().count()
        moy = round(sum(l['completude'] for l in lignes) / len(lignes)) if nb_el else None
        return dict(lignes[0], autres=lignes[1:], couples=lignes, nb_couples=nb_couples, total_valeurs=qs.count(),
                    nb_elements=nb_el, completude_moyenne=moy,
                    nb_structures=qs.values('m_structure').distinct().count(), nb_periodes=qs.values('periode').distinct().count(),
                    par_operation=par_op, trouve=True)
    except Exception:                                     # la page du brouillon ne doit jamais tomber pour ça
        log.exception('saisie_du_brouillon : lecture impossible pour DataSetOperation %s', getattr(dso, 'pk', '?'))
        return vide
