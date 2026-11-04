"""OperaPlus · normalisation des valeurs saisies avant l'enregistrement dans DSet_DElt.

Une nature (DataElement.m_value_type) = une colonne :
    Number -> m_value (FloatField)   Text -> texte_element   Date -> date_element
Le type précis (tel, gps, multi…) affine le contrôle et le format enregistré.
"""
import re
from datetime import date

OUI = {'1', 'oui', 'o', 'yes', 'y', 'true', 'vrai'}
NON = {'0', 'non', 'n', 'no', 'false', 'faux'}


class ValeurInvalide(ValueError):
    pass


def _codes(spec):
    """'choice:1=Femme;2=Homme' -> {'1', '2'} (vide si la liste n'est pas fournie)."""
    if ':' not in spec:
        return set()
    return {p.split('=')[0].strip() for p in spec.split(':', 1)[1].split(';') if '=' in p}


def _nombre(v):
    s = re.sub(r'[\s ]|fcfa|xaf|%', '', str(v), flags=re.I).replace(',', '.')
    try:
        return float(s)
    except ValueError:
        raise ValeurInvalide('nombre attendu')


def normaliser(nature, type_champ, brut, na=False):
    """Retourne le dict des champs à écrire dans DSet_DElt.
    Lève ValeurInvalide avec un message lisible par l'agent."""
    nature = (nature or 'Number').strip()
    spec = (type_champ or '').strip()
    t = spec.split(':', 1)[0].lower()
    v = '' if brut is None else str(brut).strip()
    vide = {'m_value': None, 'texte_element': None, 'date_element': None}

    if na:                                                     # « Non applicable » : jamais 0
        return dict(vide, est_na=True)

    # ---------------- Date ----------------
    if nature == 'Date':
        if not v:
            return {'date_element': None, 'est_na': False}
        try:
            d = date.fromisoformat(v[:10])
        except ValueError:
            raise ValeurInvalide('date attendue au format AAAA-MM-JJ')
        if d.year < 1900 or d > date.today():
            raise ValeurInvalide('date hors période plausible')
        return {'date_element': d, 'est_na': False}

    # ---------------- Texte ----------------
    if nature == 'Text':
        if not v:
            return {'texte_element': None, 'est_na': False}
        if t == 'tel':
            ch = re.sub(r'\D', '', v)
            if ch.startswith('00'):
                ch = ch[2:]
            if len(ch) == 9 and ch[0] in '62':                 # numéro camerounais sans indicatif
                ch = '237' + ch
            if not 8 <= len(ch) <= 15:
                raise ValeurInvalide('numéro de téléphone invalide')
            out = '+' + ch
        elif t == 'email':
            out = v.lower()
            if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]{2,}', out):
                raise ValeurInvalide('adresse e-mail invalide')
        elif t == 'gps':
            m = re.fullmatch(r'\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*', v)
            if not m or abs(float(m[1])) > 90 or abs(float(m[2])) > 180:
                raise ValeurInvalide('coordonnées « latitude, longitude » invalides')
            lat, lng = round(float(m[1]), 6), round(float(m[2]), 6)
            return {'texte_element': f'{lat:.6f},{lng:.6f}', 'valeur_json': {'lat': lat, 'lng': lng}, 'est_na': False}
        elif t == 'time':
            m = re.fullmatch(r'(\d{1,2})\s*[:hH]\s*(\d{2})(?::\d{2})?', v)
            if not m or int(m[1]) > 23 or int(m[2]) > 59:
                raise ValeurInvalide('heure attendue au format hh:mm')
            out = f'{int(m[1]):02d}:{m[2]}'
        elif t == 'multi':
            codes = sorted({c.strip() for c in re.split(r'[;,]', v) if c.strip()}, key=lambda c: (len(c), c))
            ok = _codes(spec)
            if ok and not set(codes) <= ok:
                raise ValeurInvalide('choix inconnu : ' + ', '.join(sorted(set(codes) - ok)))
            return {'texte_element': ';'.join(codes) or None, 'valeur_json': codes or None, 'est_na': False}
        elif t == 'long':
            out = v[:2000]
        else:                                                  # texte court (ou type inconnu)
            out = re.sub(r'\s+', ' ', v)[:255 if t == 'text' else 2000]
        return {'texte_element': out, 'est_na': False}

    # ---------------- Nombre ----------------
    if not v:
        return {'m_value': None, 'est_na': False}
    if t == 'yesno':
        low = v.lower()
        if low in OUI:
            return {'m_value': 1.0, 'est_na': False}
        if low in NON:
            return {'m_value': 0.0, 'est_na': False}
        raise ValeurInvalide('réponse Oui / Non attendue')
    x = _nombre(v)
    if t in ('choice', 'scale'):
        ok = _codes(spec) or ({'1', '2', '3', '4', '5'} if t == 'scale' else set())
        code = str(int(x)) if x == int(x) else str(x)
        if ok and code not in ok:
            raise ValeurInvalide(f'code « {v} » absent de la liste')
        return {'m_value': x, 'est_na': False}
    if t in ('int', 'age') and x != int(x):
        raise ValeurInvalide('nombre entier attendu')
    if t == 'age' and not 0 <= x <= 120:
        raise ValeurInvalide('âge hors limites (0 à 120)')
    if t == 'pct' and not 0 <= x <= 100:
        raise ValeurInvalide('pourcentage hors limites (0 à 100)')
    if t == 'money' and x < 0:
        raise ValeurInvalide('montant négatif')
    return {'m_value': x, 'est_na': False}
