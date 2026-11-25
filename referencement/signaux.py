"""Branché automatiquement (apps.py) sur chaque modèle déclaré dans REFERENCEMENT['SITEMAPS'] :
- l'adresse d'un objet change (titre ou slug modifié) → redirection 301 de l'ancienne vers la nouvelle ;
- un objet public est créé, modifié ou supprimé → IndexNow prévient les moteurs."""
from django.apps import apps
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save

from . import indexnow
from .conf import reglage


def _public(conf, obj):
    return all(getattr(obj, champ, None) == valeur for champ, valeur in (conf.get('filtre') or {}).items())


def _chemin(obj):
    try:
        return obj.get_absolute_url()
    except Exception:
        return None


def brancher():
    for conf in reglage('SITEMAPS').values():
        if 'modele' not in conf:
            continue
        modele = apps.get_model(conf['modele'])
        uid = 'referencement-%s' % conf['modele']

        def avant(sender, instance, conf=conf, **kw):
            instance._ref_ancien = None
            if instance.pk and not kw.get('raw'):
                ancien = sender._default_manager.filter(pk=instance.pk).first()
                if ancien is not None:
                    instance._ref_ancien = (_chemin(ancien), _public(conf, ancien))

        def apres(sender, instance, created, conf=conf, **kw):
            if kw.get('raw'):
                return
            nouveau, public = _chemin(instance), _public(conf, instance)
            ancien, etait_public = getattr(instance, '_ref_ancien', None) or (None, False)
            a_signaler = []
            if ancien and nouveau and ancien != nouveau and etait_public:
                creer_redirection(ancien, nouveau)
                a_signaler.append(ancien)
            if public or etait_public:
                a_signaler.append(nouveau)
            if a_signaler:
                transaction.on_commit(lambda: indexnow.signaler(*a_signaler))

        def supprime(sender, instance, conf=conf, **kw):
            if _public(conf, instance):
                chemin = _chemin(instance)
                transaction.on_commit(lambda: indexnow.signaler(chemin))

        pre_save.connect(avant, sender=modele, weak=False, dispatch_uid=uid + '-avant')
        post_save.connect(apres, sender=modele, weak=False, dispatch_uid=uid + '-apres')
        post_delete.connect(supprime, sender=modele, weak=False, dispatch_uid=uid + '-supprime')


def creer_redirection(ancien, nouveau):
    """Crée ancien → nouveau, raccourcit les chaînes (A→B puis B→C devient A→C) et évite les boucles."""
    from .models import Redirection
    Redirection.objects.filter(ancien=nouveau).delete()                     # la nouvelle adresse redevient une vraie page
    Redirection.objects.filter(nouveau=ancien).update(nouveau=nouveau)      # A→B, B→C : A→C directement
    Redirection.objects.update_or_create(ancien=ancien, defaults={'nouveau': nouveau, 'automatique': True})
