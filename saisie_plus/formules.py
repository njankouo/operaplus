"""OperaPlus · indicateurs calculés à partir d'autres indicateurs (indicateurs composites / dérivés).

Syntaxe des formules
    $12$   élément de données n° 12 (inchangé)
    #9#    indicateur n° 9 (nouveau)
    ex. Indice de qualité du service = ( #9# + #10# + #11# ) / 3

Principe : « développer » la formule
    Avant tout calcul, chaque #id# est remplacé par la formule de cet indicateur, entre parenthèses,
    et ainsi de suite jusqu'à ne plus contenir que des $id$. Le reste d'OperaPlus (page de saisie,
    /get_elements/, calculs analytiques) continue donc de recevoir une formule « classique ».

    Avantage MEAL : un indicateur composite est toujours recalculé à partir des données brutes
    (numérateurs et dénominateurs), jamais en faisant la moyenne de taux déjà calculés.

Contrôles
    - indicateur inconnu, indicateur en saisie manuelle (sans formule) : refusés ;
    - boucle (A utilise B qui utilise A) : refusée, avec le chemin de la boucle ;
    - profondeur maximale : 10 niveaux.
"""
import ast
import operator
import re

JETON = re.compile(r'\$(\d+)\$|#(\d+)#')
PROFONDEUR_MAX = 10
CHAMPS_FORMULE = ('numerateur', 'm_numerateur', 'formule', 'm_formule', 'm_formula', 'formula')


class FormuleInvalide(ValueError):
    pass


# ---------------------------------------------------------------- accès aux indicateurs
def _modele():
    from django.apps import apps
    return apps.get_model('ctn_bpf', 'Indicateur')


def champ_formule():
    """Nom du champ qui porte la formule (réglable : SAISIE_PLUS_CHAMP_FORMULE dans settings)."""
    from django.conf import settings
    fixe = getattr(settings, 'SAISIE_PLUS_CHAMP_FORMULE', '')
    if fixe:
        return fixe
    noms = {f.name for f in _modele()._meta.get_fields()}
    for c in CHAMPS_FORMULE:
        if c in noms:
            return c
    raise FormuleInvalide("Champ de formule introuvable sur Indicateur : définissez SAISIE_PLUS_CHAMP_FORMULE.")


def charger_formules(ids):
    """{id: formule ou ''} pour les indicateurs demandés (une seule requête)."""
    c = champ_formule()
    return {i: (f or '').strip() for i, f in _modele().objects.filter(id__in=ids).values_list('id', c)}


def nom_indicateur(i):
    o = _modele().objects.filter(id=i).first()
    return str(o) if o else f'#{i}'


# ---------------------------------------------------------------- analyse
def extraire(formule):
    """→ (ids des éléments de données, ids des indicateurs) cités directement."""
    de, ind = [], []
    for m in JETON.finditer(formule or ''):
        (de if m.group(1) else ind).append(int(m.group(1) or m.group(2)))
    return de, ind


def developper(formule, charger=charger_formules, _chemin=()):
    """Remplace récursivement chaque #id# par (formule de l'indicateur). Lève FormuleInvalide."""
    formule = (formule or '').strip()
    _, inds = extraire(formule)
    if not inds:
        return formule
    if len(_chemin) >= PROFONDEUR_MAX:
        raise FormuleInvalide(f"Trop de niveaux d'indicateurs imbriqués (plus de {PROFONDEUR_MAX}).")
    formules = charger(set(inds))
    rempl = {}
    for i in set(inds):
        if i in _chemin:
            boucle = ' → '.join(f'#{x}#' for x in _chemin[_chemin.index(i):] + (i,))
            raise FormuleInvalide(f"Boucle entre indicateurs : {boucle}.")
        if i not in formules:
            raise FormuleInvalide(f"Indicateur #{i}# introuvable.")
        if not formules[i]:
            raise FormuleInvalide(f"L'indicateur #{i}# est en saisie manuelle (sans formule) : il ne peut pas servir dans un calcul.")
        rempl[i] = '(' + developper(formules[i], charger, _chemin + (i,)) + ')'
    return re.sub(r'#(\d+)#', lambda m: rempl[int(m.group(1))], formule)


def verifier(formule, indicateur_id=None, charger=charger_formules):
    """Messages d'erreur (liste vide = formule correcte), à appeler avant d'enregistrer un indicateur."""
    erreurs = []
    if indicateur_id is not None and f'#{indicateur_id}#' in (formule or ''):
        return ["Un indicateur ne peut pas se citer lui-même."]
    try:
        dev = developper(formule, charger, (indicateur_id,) if indicateur_id is not None else ())
    except FormuleInvalide as e:
        return [str(e)]
    try:
        evaluer(dev, {i: 1 for i in extraire(dev)[0]})
    except ZeroDivisionError:
        pass                                           # possible avec des 1 partout : pas une erreur de syntaxe
    except FormuleInvalide as e:
        erreurs.append(str(e))
    return erreurs


# ---------------------------------------------------------------- calcul sûr (sans eval)
_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos}


def evaluer(formule, valeurs):
    """Calcule une formule développée. valeurs = {id_element: nombre}. Élément absent = 0 (comme la page de saisie).
    Lève ZeroDivisionError si division par zéro, FormuleInvalide si la formule est incorrecte."""
    if re.search(r'#\d+#', formule or ''):
        formule = developper(formule)
    expr = JETON.sub(lambda m: f'v{m.group(1)}', formule or '').replace(',', '.')
    if not expr.strip():
        raise FormuleInvalide('Formule vide.')
    try:
        arbre = ast.parse(expr, mode='eval')
    except SyntaxError:
        raise FormuleInvalide('Formule mal écrite (parenthèse, opérateur ou nombre).')

    def calc(n):
        if isinstance(n, ast.Expression):
            return calc(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.Name) and re.fullmatch(r'v\d+', n.id):
            v = valeurs.get(int(n.id[1:]), 0)
            return float(v) if v not in (None, '') else 0.0
        if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](calc(n.left), calc(n.right))
        if isinstance(n, ast.UnaryOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](calc(n.operand))
        raise FormuleInvalide('Élément non autorisé dans la formule.')
    return calc(arbre)


def dependances(formule, charger=charger_formules):
    """Tous les éléments de données nécessaires après développement (pour /get_elements/ → data_elts)."""
    return sorted(set(extraire(developper(formule, charger))[0]))
