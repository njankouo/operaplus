from django import template
from decimal import Decimal

register = template.Library()

@register.filter
def get_valeur(mapping, key):
    if not mapping or not key:
        return ""
    try:
        # On sépare la clé "ID_S,ID_P"
        parts = str(key).split(',')
        s_id, p_id = int(parts[0]), int(parts[1])
        
        valeur = mapping.get((s_id, p_id))
        
        if valeur is not None:
            # Conversion forcée en Decimal pour un nettoyage propre
            d = Decimal(str(valeur)).normalize()
            
            # '{:f}'.format(d) : Force l'affichage fixe (pas de 1e+2)
            # '{:g}'.format(d) : Format intelligent (enlève les zéros inutiles)
            # On utilise :g pour que 100.00 devienne 100
            val_str = "{:g}".format(d)
            
            # Sécurité : Si le nombre est très petit (ex: 0.0000001), 
            # on s'assure qu'il ne repasse pas en notation scientifique
            if 'e' in val_str.lower():
                val_str = "{:.2f}".format(d).rstrip('0').rstrip('.')
                
            return val_str
    except (ValueError, TypeError, IndexError):
        pass
    return ""