"""
Intégration des déclarations faites hors ligne.

Plutôt que de recopier la logique métier d'OperaPlus (échéance, HistoricRACI, IndicateurValeur,
propagation aux tâches...), on REJOUE la déclaration dans votre vue existante, exactement comme
si l'agent avait envoyé le formulaire « commentaire » : même code, mêmes contrôles, mêmes calculs.

settings (facultatif) :
    COLLECTE_URL_DECLARATION = '/transaction-rapport/'     # action du formulaire commentaire
    COLLECTE_CHAMPS_DECLARATION = {}                       # champs fixes supplémentaires à envoyer
"""
import logging
import os
from importlib import import_module

from django.conf import settings
from django.contrib import messages
from django.contrib.messages.storage.session import SessionStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from django.urls import resolve
from django.utils import timezone

log = logging.getLogger(__name__)


def _role(user):
    perso = getattr(user, 'personnel', None)
    return getattr(perso, 'nom', '') or str(perso or '') or user.get_full_name() or user.username


def integrer(declaration):
    """Retourne (statut, message) et met à jour la déclaration."""
    url = getattr(settings, 'COLLECTE_URL_DECLARATION', '/transaction-rapport/')
    d = declaration
    donnees = {
        'operation_id': str(d.operation_id),
        'history': str(d.echeance_id or ''),
        'commentaire': d.commentaire,
        'niveau_execution': ('%f' % d.niveau).rstrip('0').rstrip('.'),
        'date_realisation': d.date_realisation.isoformat() if d.date_realisation else '',
        'role': _role(d.agent) if d.agent else '',
    }
    donnees.update(getattr(settings, 'COLLECTE_CHAMPS_DECLARATION', {}))
    if d.fichier:
        try:
            with d.fichier.open('rb') as f:
                donnees['file'] = SimpleUploadedFile(os.path.basename(d.fichier.name), f.read())
        except OSError:
            pass
    try:
        req = RequestFactory().post(url, data=donnees)
        req.user = d.agent
        req.session = import_module(settings.SESSION_ENGINE).SessionStore()
        req._messages = SessionStorage(req)
        req.META['HTTP_REFERER'] = '/terrain/'
        req.META['REMOTE_ADDR'] = '127.0.0.1'
        req.collecte_terrain = True
        cible = resolve(url)
        resp = cible.func(req, *cible.args, **cible.kwargs)
        msgs = list(getattr(req._messages, '_queued_messages', []))
        erreurs = [str(m) for m in msgs if m.level >= messages.ERROR]
        if erreurs:
            statut, texte = 'rejete', erreurs[0]
        elif getattr(resp, 'status_code', 200) >= 500:
            statut, texte = 'erreur', 'Erreur serveur %s' % resp.status_code
        elif getattr(resp, 'status_code', 200) in (401, 403):
            statut, texte = 'rejete', 'Accès refusé par OperaPlus.'
        else:
            ok = [str(m) for m in msgs if m.level == messages.SUCCESS]
            statut, texte = 'integre', (ok[0] if ok else 'Déclaration enregistrée dans OperaPlus.')
    except Exception as e:  # on garde la déclaration, on pourra réessayer
        log.exception('collecte : intégration de la déclaration %s', d.uuid)
        statut, texte = 'erreur', ('%s : %s' % (type(e).__name__, e))[:480]
    d.statut, d.message = statut, texte[:500]
    d.essais_integration += 1
    if statut == 'integre':
        d.integre_le = timezone.now()
    d.save(update_fields=['statut', 'message', 'essais_integration', 'integre_le'])
    return statut, texte
