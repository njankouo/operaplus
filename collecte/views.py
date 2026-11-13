"""
Application « collecte » — OperaPlus Terrain.
  • /terrain/            la PWA (fonctionne hors ligne une fois ouverte une première fois)
  • /terrain/api/...     synchronisation (idempotente : un envoi répété ne crée jamais de doublon)
  • /terrain/gestion/... côté bureau : questionnaires, données reçues, déclarations
"""
import csv
import io
import json
import os
from datetime import datetime
from decimal import Decimal, InvalidOperation
from functools import wraps

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction as db_transaction
from django.db.models import Count, Q
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render, resolve_url
from django.templatetags.static import static
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST
from django.middleware.csrf import get_token

from . import fournisseur
from .integration import integrer
from .models import TYPES_QUESTION, Declaration, Formulaire, PieceJointe, Soumission

VERSION_APP = '1.2.0'
VIOLET = '#5B3FE0'
TAILLE_MAX = lambda: int(getattr(settings, 'COLLECTE_TAILLE_MAX_MO', 15)) * 1024 * 1024


# ============================================================ outils
def _inst_id(user):
    perso = getattr(user, 'personnel', None)
    return getattr(perso, 'actual_institution_id', None) if perso is not None else None


def _gestionnaire(user):
    return user.is_superuser or user.is_staff or user.has_perm('collecte.gerer_collecte')


def api(vue):
    """Connexion obligatoire, mais réponse JSON 401 (jamais de redirection vers la page de connexion)."""
    @wraps(vue)
    def enveloppe(request, *a, **k):
        if not request.user.is_authenticated:
            return JsonResponse({'ok': False, 'code': 'deconnecte', 'message': 'Session expirée : reconnectez-vous (vos données restent sur le téléphone).'}, status=401)
        return vue(request, *a, **k)
    return enveloppe


def gestion(vue):
    @wraps(vue)
    @login_required
    def enveloppe(request, *a, **k):
        if not _gestionnaire(request.user):
            raise PermissionDenied
        return vue(request, *a, **k)
    return enveloppe


def _formulaires_visibles(request):
    inst = _inst_id(request.user)
    qs = Formulaire.objects.all()
    if inst is not None:
        qs = qs.filter(Q(institution_id=inst) | Q(institution_id__isnull=True))
    return qs


def _date_terrain(v):
    d = parse_datetime(v or '') if v else None
    if d is not None and timezone.is_naive(d):
        d = timezone.make_aware(d)
    return d


def _flottant(v):
    try:
        return float(v) if v not in (None, '') else None
    except (TypeError, ValueError):
        return None


# ============================================================ PWA
@never_cache
def pwa(request):
    if not request.user.is_authenticated:
        return redirect(reverse('collecte_connexion'))
    perso = getattr(request.user, 'personnel', None)
    inst = getattr(perso, 'actual_institution', None) if perso is not None else None
    return render(request, 'collecte/pwa.html', {
        'version': VERSION_APP,
        'nom': str(perso or '') or request.user.get_full_name() or request.user.username,
        'prenom': request.user.first_name or (str(perso or '') or request.user.username).split(' ')[0],
        'email': request.user.email,
        'institution': str(inst) if inst is not None else '',
        'csrf': get_token(request),
        'gestionnaire': _gestionnaire(request.user),
    })


@never_cache
def connexion(request):
    """Page de connexion aux couleurs de l'appli terrain (utilise les comptes OperaPlus)."""
    from django.contrib.auth import login
    from django.contrib.auth.forms import AuthenticationForm
    if request.user.is_authenticated:
        return redirect(reverse('collecte_pwa'))
    form = AuthenticationForm(request, data=request.POST or None)
    if request.method == 'POST' and form.is_valid():
        login(request, form.get_user())
        return redirect(reverse('collecte_pwa'))
    return render(request, 'collecte/connexion.html', {'form': form, 'version': VERSION_APP})


@require_POST
def deconnexion(request):
    from django.contrib.auth import logout
    logout(request)
    return redirect(reverse('collecte_connexion'))


def manifeste(request):
    racine = reverse('collecte_pwa')
    data = {
        'name': 'OperaPlus Terrain', 'short_name': 'OP Terrain',
        'description': 'Déclarations d’avancement et questionnaires de terrain, même sans réseau.',
        'start_url': racine, 'scope': racine, 'display': 'standalone', 'orientation': 'portrait',
        'background_color': '#0E0D1A', 'theme_color': VIOLET, 'lang': 'fr',
        'icons': [
            {'src': static('collecte/icones/icone-192.png'), 'sizes': '192x192', 'type': 'image/png'},
            {'src': static('collecte/icones/icone-512.png'), 'sizes': '512x512', 'type': 'image/png'},
            {'src': static('collecte/icones/icone-512-maskable.png'), 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ],
    }
    return HttpResponse(json.dumps(data, ensure_ascii=False), content_type='application/manifest+json')


@never_cache
def service_worker(request):
    resp = render(request, 'collecte/sw.js', {
        'version': VERSION_APP, 'racine': reverse('collecte_pwa'),
        'sync_js': static('collecte/sync.js'), 'icone': static('collecte/icones/icone-192.png'),
        'fichiers': [static('collecte/terrain.css'), static('collecte/terrain.js')],
        'icones': [static('collecte/icones/icone-192.png'), static('collecte/icones/icone-512.png')],
    }, content_type='application/javascript')
    resp['Service-Worker-Allowed'] = reverse('collecte_pwa')
    return resp


# ============================================================ API de synchronisation
@require_GET
@never_cache
def api_ping(request):
    return JsonResponse({'ok': True, 'connecte': request.user.is_authenticated, 't': timezone.now().isoformat(), 'v': VERSION_APP})


@api
@require_GET
@never_cache
def api_paquet(request):
    """Tout ce dont le téléphone a besoin pour travailler hors ligne."""
    perso = getattr(request.user, 'personnel', None)
    formulaires = [{'id': f.pk, 'titre': f.titre, 'description': f.description, 'version': f.version,
                    'questions': f.questions, 'gps_obligatoire': f.gps_obligatoire}
                   for f in _formulaires_visibles(request).filter(actif=True)]
    return JsonResponse({
        'ok': True, 'genere_le': timezone.now().isoformat(), 'version': VERSION_APP, 'csrf': get_token(request),
        'utilisateur': {'id': request.user.pk, 'nom': str(perso or '') or request.user.get_full_name() or request.user.username},
        'formulaires': formulaires,
        'taches': fournisseur.taches(request),
        'raci': fournisseur.raci(request),
        'liens': {'valider': getattr(settings, 'COLLECTE_URL_VALIDATION', '/valid-transaction/?operation={id}'),
                  'operation': getattr(settings, 'COLLECTE_URL_OPERATION', '')},
        'taille_max': TAILLE_MAX(),
    })


@api
@require_POST
def api_soumission(request):
    try:
        p = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'ok': False, 'message': 'Données illisibles.'}, status=400)
    uid = p.get('uuid')
    existe = Soumission.objects.filter(uuid=uid).first() if uid else None
    if existe:
        return JsonResponse({'ok': True, 'uuid': str(existe.uuid), 'id': existe.pk, 'statut': existe.statut, 'deja': True})
    f = _formulaires_visibles(request).filter(pk=p.get('formulaire_id')).first()
    if f is None:
        return JsonResponse({'ok': False, 'definitif': True, 'message': 'Questionnaire introuvable ou retiré.'}, status=404)
    donnees = p.get('donnees') if isinstance(p.get('donnees'), dict) else {}
    gps = p.get('gps') or {}
    try:
        with db_transaction.atomic():
            s = Soumission.objects.create(
                uuid=uid, formulaire=f, version_formulaire=int(p.get('version') or f.version), donnees=donnees,
                latitude=_flottant(gps.get('lat')), longitude=_flottant(gps.get('lon')), precision_m=_flottant(gps.get('precision')),
                agent=request.user, institution_id=_inst_id(request.user), appareil=(request.META.get('HTTP_USER_AGENT') or '')[:200],
                cree_le_terrain=_date_terrain(p.get('cree_le')), pieces_attendues=int(p.get('pieces') or 0))
    except IntegrityError:  # même envoi reçu deux fois en parallèle
        s = Soumission.objects.get(uuid=uid)
    except (ValueError, TypeError) as e:
        return JsonResponse({'ok': False, 'definitif': True, 'message': 'Envoi invalide : %s' % e}, status=400)
    return JsonResponse({'ok': True, 'uuid': str(s.uuid), 'id': s.pk, 'statut': s.statut})


@api
@require_POST
def api_piece(request):
    uid = request.POST.get('uuid')
    if uid and PieceJointe.objects.filter(uuid=uid).exists():
        return JsonResponse({'ok': True, 'deja': True})
    s = Soumission.objects.filter(uuid=request.POST.get('soumission'), agent=request.user).first()
    f = request.FILES.get('fichier')
    if s is None:
        return JsonResponse({'ok': False, 'message': 'Questionnaire parent pas encore reçu.'}, status=409)
    if f is None:
        return JsonResponse({'ok': False, 'definitif': True, 'message': 'Fichier manquant.'}, status=400)
    if f.size > TAILLE_MAX():
        return JsonResponse({'ok': False, 'definitif': True, 'message': 'Fichier trop lourd.'}, status=413)
    try:
        PieceJointe.objects.create(uuid=uid, soumission=s, question_id=(request.POST.get('question') or '')[:60], fichier=f)
    except IntegrityError:
        pass
    return JsonResponse({'ok': True})


@api
@require_POST
def api_declaration(request):
    P = request.POST
    uid = P.get('uuid')
    d = Declaration.objects.filter(uuid=uid).first() if uid else None
    if d is None:
        try:
            niveau = Decimal(str(P.get('niveau', '')).replace(',', '.'))
        except InvalidOperation:
            return JsonResponse({'ok': False, 'definitif': True, 'message': 'Niveau d’avancement invalide.'}, status=400)
        if not (0 <= niveau <= 100) or not (P.get('commentaire') or '').strip() or not (P.get('operation_id') or '').isdigit():
            return JsonResponse({'ok': False, 'definitif': True, 'message': 'Déclaration incomplète (opération, niveau 0-100 et commentaire obligatoires).'}, status=400)
        f = request.FILES.get('fichier')
        if f and f.size > TAILLE_MAX():
            return JsonResponse({'ok': False, 'definitif': True, 'message': 'Pièce jointe trop lourde.'}, status=413)
        try:
            with db_transaction.atomic():
                d = Declaration.objects.create(
                    uuid=uid, agent=request.user, institution_id=_inst_id(request.user),
                    operation_id=int(P['operation_id']), echeance_id=int(P['echeance_id']) if (P.get('echeance_id') or '').isdigit() else None,
                    operation_nom=(P.get('operation_nom') or '')[:255], niveau=niveau, commentaire=P['commentaire'].strip(),
                    date_realisation=parse_date(P.get('date_realisation') or '') or timezone.localdate(),
                    fichier=f or '', latitude=_flottant(P.get('lat')), longitude=_flottant(P.get('lon')), precision_m=_flottant(P.get('precision')),
                    cree_le_terrain=_date_terrain(P.get('cree_le')))
        except IntegrityError:
            d = Declaration.objects.get(uuid=uid)
    if d.statut in ('recu', 'erreur'):
        integrer(d)
    return JsonResponse({'ok': True, 'uuid': str(d.uuid), 'statut': d.statut, 'message': d.message})


@api
@require_POST
def api_etat(request):
    """Le téléphone demande ce que sont devenus ses envois (validés, refusés...)."""
    try:
        uuids = json.loads(request.body.decode('utf-8')).get('uuids', [])[:500]
    except (ValueError, AttributeError):
        uuids = []
    res = {}
    for s in Soumission.objects.filter(uuid__in=uuids, agent=request.user):
        res[str(s.uuid)] = {'statut': s.statut, 'message': s.commentaire_validation, 'complet': s.complete()}
    for d in Declaration.objects.filter(uuid__in=uuids, agent=request.user):
        res[str(d.uuid)] = {'statut': d.statut, 'message': d.message}
    return JsonResponse({'ok': True, 'etats': res})


# ============================================================ bureau : questionnaires
@gestion
def g_accueil(request):
    forms = _formulaires_visibles(request).annotate(nb=Count('soumissions'), nb_attente=Count('soumissions', filter=Q(soumissions__statut='recu')))
    inst = _inst_id(request.user)
    decl = Declaration.objects.filter(institution_id=inst) if inst is not None else Declaration.objects.all()
    return render(request, 'collecte/g_accueil.html', {
        'formulaires': forms, 'decl_total': decl.count(), 'decl_erreur': decl.filter(statut__in=['erreur', 'rejete']).count(),
        'decl_recentes': decl.select_related('agent')[:6], 'url_pwa': request.build_absolute_uri(reverse('collecte_pwa')),
    })


@gestion
def g_formulaire(request, pk=None):
    f = get_object_or_404(_formulaires_visibles(request), pk=pk) if pk else None
    if request.method == 'POST':
        try:
            questions = json.loads(request.POST.get('questions') or '[]')
            assert isinstance(questions, list)
        except (ValueError, AssertionError):
            questions = None
        titre = (request.POST.get('titre') or '').strip()
        if not titre or questions is None:
            return render(request, 'collecte/g_formulaire.html', {'f': f, 'erreur': 'Titre obligatoire et questions valides.', 'types': TYPES_QUESTION,
                                                                  'questions_data': questions or []})
        propres, vus = [], set()
        for i, q in enumerate(questions):
            qid = str(q.get('id') or 'q%d' % (i + 1))[:60]
            while qid in vus:
                qid += '_'
            vus.add(qid)
            propres.append({'id': qid, 'libelle': str(q.get('libelle') or '')[:300], 'type': q.get('type') if q.get('type') in dict(TYPES_QUESTION) else 'texte',
                            'obligatoire': bool(q.get('obligatoire')), 'choix': [str(c)[:120] for c in (q.get('choix') or []) if str(c).strip()][:60],
                            'min': q.get('min'), 'max': q.get('max'), 'aide': str(q.get('aide') or '')[:300],
                            'si': q.get('si') if isinstance(q.get('si'), dict) and q['si'].get('question') else None})
        if f is None:
            f = Formulaire(cree_par=request.user, institution_id=_inst_id(request.user))
        elif f.questions != propres:
            f.version += 1
        f.titre, f.description, f.questions = titre, request.POST.get('description', ''), propres
        f.actif = request.POST.get('actif') == '1'
        f.gps_obligatoire = request.POST.get('gps_obligatoire') == '1'
        f.save()
        return redirect(reverse('collecte_g_formulaire', args=[f.pk]) + '?ok=1')
    return render(request, 'collecte/g_formulaire.html', {'f': f, 'types': TYPES_QUESTION, 'ok': request.GET.get('ok'),
                                                          'questions_data': f.questions if f else []})


@gestion
def g_donnees(request, pk):
    f = get_object_or_404(_formulaires_visibles(request), pk=pk)
    if request.method == 'POST':
        s = get_object_or_404(Soumission, pk=request.POST.get('id'), formulaire=f)
        if request.POST.get('action') in ('valide', 'rejete', 'recu'):
            s.statut = request.POST['action']
            s.commentaire_validation = (request.POST.get('commentaire') or '')[:255]
            s.valide_par = request.user
            s.save(update_fields=['statut', 'commentaire_validation', 'valide_par'])
        return redirect(request.get_full_path())
    qs = f.soumissions.select_related('agent').prefetch_related('pieces')
    if request.GET.get('statut'):
        qs = qs.filter(statut=request.GET['statut'])
    questions = [q for q in f.questions if q.get('type') != 'note']
    if request.GET.get('format') == 'csv':
        out = io.StringIO()
        out.write('﻿')
        w = csv.writer(out, delimiter=';')
        w.writerow(['N°', 'Reçu le', 'Saisi le', 'Agent', 'Statut', 'Latitude', 'Longitude', 'Précision (m)'] + [q.get('libelle') or q['id'] for q in questions])
        for s in qs:
            ligne = [s.pk, timezone.localtime(s.recu_le).strftime('%d/%m/%Y %H:%M'),
                     timezone.localtime(s.cree_le_terrain).strftime('%d/%m/%Y %H:%M') if s.cree_le_terrain else '',
                     (s.agent.get_full_name() or s.agent.username) if s.agent else '', s.get_statut_display(), s.latitude or '', s.longitude or '', s.precision_m or '']
            for q in questions:
                v = s.donnees.get(q['id'], '')
                if isinstance(v, list):
                    v = ', '.join(map(str, v))
                elif isinstance(v, dict):
                    v = '%s, %s' % (v.get('lat', ''), v.get('lon', '')) if 'lat' in v else json.dumps(v, ensure_ascii=False)
                elif q['type'] in ('photo', 'signature'):
                    v = 'oui' if v else ''
                ligne.append(v)
            w.writerow(ligne)
        resp = HttpResponse(out.getvalue(), content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="collecte_%d_%s.csv"' % (f.pk, timezone.localdate().strftime('%Y%m%d'))
        return resp
    lignes = []
    for s in qs[:500]:
        pieces = {p.question_id: p for p in s.pieces.all()}
        cellules = []
        for q in questions[:8]:
            v = s.donnees.get(q['id'], '')
            if q['type'] in ('photo', 'signature'):
                cellules.append({'piece': pieces.get(q['id'])})
            elif isinstance(v, list):
                cellules.append({'v': ', '.join(map(str, v))})
            elif isinstance(v, dict) and 'lat' in v:
                cellules.append({'gps': v})
            else:
                cellules.append({'v': v})
        lignes.append({'s': s, 'cellules': cellules})
    stats = f.soumissions.aggregate(total=Count('id'), recu=Count('id', filter=Q(statut='recu')), valide=Count('id', filter=Q(statut='valide')), rejete=Count('id', filter=Q(statut='rejete')))
    return render(request, 'collecte/g_donnees.html', {'f': f, 'questions': questions[:8], 'lignes': lignes, 'stats': stats, 'statut': request.GET.get('statut', '')})


@gestion
def g_piece(request, uuid):
    p = get_object_or_404(PieceJointe, uuid=uuid)
    if _inst_id(request.user) is not None and p.soumission.institution_id not in (None, _inst_id(request.user)):
        raise Http404
    return FileResponse(p.fichier.open('rb'))


@gestion
def g_declarations(request):
    inst = _inst_id(request.user)
    qs = Declaration.objects.select_related('agent')
    if inst is not None:
        qs = qs.filter(institution_id=inst)
    if request.method == 'POST':
        d = get_object_or_404(qs, pk=request.POST.get('id'))
        if d.statut != 'integre':
            integrer(d)
        return redirect(request.get_full_path())
    if request.GET.get('statut'):
        qs = qs.filter(statut=request.GET['statut'])
    return render(request, 'collecte/g_declarations.html', {'declarations': qs[:300], 'statut': request.GET.get('statut', '')})
