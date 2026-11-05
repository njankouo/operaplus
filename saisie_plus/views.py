"""API JSON utilisée par la page de saisie (aucune modification de ctn_bpf/views.py).

GET  /saisie-plus/api/completude/<dataset>/<periode>/                → éléments saisis par unité (pastilles de l'arbre)
GET  /saisie-plus/api/valeurs/<structure>/<periode>/?dataset=        → toutes les valeurs (nombre, texte, date, N/A)
GET  /saisie-plus/api/journal/?dataset=&structure=&periode=          → dernière saisie + nombre total
POST /saisie-plus/api/journal/         {dataset, structure, periode, nb_valeurs, nb_modifiees}
GET  /saisie-plus/api/justifications/?dataset=&structure=&periode=   → justifications enregistrées
POST /saisie-plus/api/justifications/  {dataset, structure, periode, items: [{element_id, valeur, motif, texte}]}
     (un texte vide supprime la justification de l'élément)
"""
import json

from django.apps import apps
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods

from .models import EnTete, JournalSaisie, Justification


def _nom(user):
    if not user:
        return ''
    return user.get_full_name() or user.username


def _contexte(src):
    try:
        return {'dataset_id': int(src.get('dataset')), 'structure_id': int(src.get('structure')),
                'periode': str(src.get('periode') or '')[:64]}
    except (TypeError, ValueError):
        return None


def _corps(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except (ValueError, UnicodeDecodeError):
        return None


def _erreur(msg, status=400):
    return JsonResponse({'ok': False, 'error': msg}, status=status)


@login_required
@require_http_methods(['GET', 'POST'])
def journal(request):
    if request.method == 'GET':
        ctx = _contexte(request.GET)
        if not ctx or not ctx['periode']:
            return _erreur('Paramètres dataset, structure et periode requis.')
        qs = JournalSaisie.objects.filter(**ctx).select_related('user')
        last = qs.first()
        return JsonResponse({'ok': True, 'total': qs.count(), 'last': last and {
            'user': _nom(last.user), 'date': last.date.isoformat(),
            'nb_valeurs': last.nb_valeurs, 'nb_modifiees': last.nb_modifiees}})

    data = _corps(request)
    ctx = data is not None and _contexte(data)
    if not ctx or not ctx['periode']:
        return _erreur('Contexte de saisie incomplet.')
    try:
        nb, nm = max(0, int(data.get('nb_valeurs') or 0)), max(0, int(data.get('nb_modifiees') or 0))
    except (TypeError, ValueError):
        nb = nm = 0
    JournalSaisie.objects.create(user=request.user, nb_valeurs=nb, nb_modifiees=nm, **ctx)
    return JsonResponse({'ok': True})


@login_required
@require_http_methods(['GET', 'POST'])
def justifications(request):
    if request.method == 'GET':
        ctx = _contexte(request.GET)
        if not ctx or not ctx['periode']:
            return _erreur('Paramètres dataset, structure et periode requis.')
        items = [{'element_id': j.element_id, 'valeur': j.valeur, 'motif': j.motif, 'texte': j.texte,
                  'user': _nom(j.user), 'date': j.date.isoformat()}
                 for j in Justification.objects.filter(**ctx).select_related('user')]
        return JsonResponse({'ok': True, 'items': items})

    data = _corps(request)
    ctx = data is not None and _contexte(data)
    if not ctx or not ctx['periode']:
        return _erreur('Contexte de saisie incomplet.')
    n = 0
    for it in (data.get('items') or [])[:500]:
        try:
            el = int(it.get('element_id'))
        except (TypeError, ValueError, AttributeError):
            continue
        texte = str(it.get('texte') or '').strip()[:2000]
        if not texte:
            Justification.objects.filter(element_id=el, **ctx).delete()
            continue
        Justification.objects.update_or_create(element_id=el, **ctx, defaults={
            'texte': texte, 'valeur': str(it.get('valeur') or '')[:64],
            'motif': str(it.get('motif') or '')[:255], 'user': request.user})
        n += 1
    return JsonResponse({'ok': True, 'enregistrees': n})


@login_required
@require_http_methods(['GET'])
def completude(request, dataset_id, periode):
    """Nombre d'éléments de données saisis par unité pour un formulaire et une période.
    Réponse : {ok, total, resultats: {"<structure_id>": {"remplis": n, "total": t}}}"""
    DataSet = apps.get_model('ctn_bpf', 'DataSet')
    DSet_DElt = apps.get_model('ctn_bpf', 'DSet_DElt')
    ds = DataSet.objects.filter(id=dataset_id).first()
    if not ds:
        return _erreur('Formulaire introuvable.', 404)
    ids = list(ds.m_dataelements.values_list('id', flat=True))
    total = len(ids)
    champs = {f.name for f in DSet_DElt._meta.get_fields()}
    rempli = Q(m_value__isnull=False)
    for nom, q in (('texte_element', Q(texte_element__isnull=False) & ~Q(texte_element='')),
                   ('date_element', Q(date_element__isnull=False)), ('est_na', Q(est_na=True))):
        if nom in champs:
            rempli |= q
    lignes = (DSet_DElt.objects.filter(periode_id=periode, m_dataelement_id__in=ids).filter(rempli)
              .values('m_structure_id').annotate(n=Count('m_dataelement', distinct=True)))
    return JsonResponse({'ok': True, 'total': total, 'resultats': {
        str(l['m_structure_id']): {'remplis': l['n'], 'total': total} for l in lignes if l['m_structure_id']}})


def _fichier_de(x):
    """Pièce jointe d'une valeur (champ Fichier / Photo), au format attendu par la page de saisie."""
    from .models import PieceJointe
    pid = getattr(x, 'fichier_element_id', None)
    p = pid and PieceJointe.objects.filter(id=pid).first()
    return info_piece(p) if p else None


@login_required
@require_http_methods(['GET'])
def valeurs(request, structure_id, periode):
    """Remplace /load_data/ pour la page de saisie : renvoie aussi les textes, les dates et les N/A.
    Même format que load_data : {data: [{id, content, texte, date, na}]} (id = data element)."""
    DSet_DElt = apps.get_model('ctn_bpf', 'DSet_DElt')
    champs = {f.name for f in DSet_DElt._meta.get_fields()}
    qs = DSet_DElt.objects.filter(m_structure_id=structure_id, periode_id=periode, m_dataelement__isnull=False)
    ds_id = request.GET.get('dataset')
    if ds_id and ds_id.isdigit():
        DataSet = apps.get_model('ctn_bpf', 'DataSet')
        ds = DataSet.objects.filter(id=int(ds_id)).first()
        if ds:
            qs = qs.filter(m_dataelement_id__in=ds.m_dataelements.values_list('id', flat=True))
    # une ligne par élément : la saisie manuelle (comment vide) d'abord, puis la plus récente
    vus, data = set(), []
    for x in qs.order_by('m_dataelement_id', '-id'):
        manuelle = not (x.comment or '').strip()
        cle = x.m_dataelement_id
        if cle in vus:
            continue
        if not manuelle and qs.filter(m_dataelement_id=cle).filter(Q(comment__isnull=True) | Q(comment='')).exists():
            continue                                    # une saisie manuelle existe : elle passe avant le cumul auto
        vus.add(cle)
        v = x.m_value
        if isinstance(v, float) and v.is_integer():
            v = int(v)                                  # 12.0 -> 12 pour l'affichage
        d = getattr(x, 'date_element', None) if 'date_element' in champs else None
        data.append({'id': cle, 'content': v,
                     'texte': getattr(x, 'texte_element', None) if 'texte_element' in champs else None,
                     'date': d.isoformat() if d else None,
                     'na': bool(getattr(x, 'est_na', False)) if 'est_na' in champs else False,
                     'fichier': _fichier_de(x) if 'fichier_element' in champs else None})
    return JsonResponse({'data': data})


# ======================================================================
#  En-tête des formulaires (logo de l'organisation, logo partenaire, lignes)
# ======================================================================

TYPES_IMAGES = {'.png': b'\x89PNG', '.jpg': b'\xff\xd8\xff', '.jpeg': b'\xff\xd8\xff', '.webp': b'RIFF'}
TAILLE_MAX = 2 * 1024 * 1024                                      # 2 Mo


def _image_valide(f):
    """PNG, JPEG ou WebP de 2 Mo au plus, vérifié sur le contenu (pas seulement l'extension).
    Le SVG est refusé : il peut contenir du script."""
    import os
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in TYPES_IMAGES:
        return 'Format accepté : PNG, JPG ou WebP.'
    if f.size > TAILLE_MAX:
        return 'Image trop lourde : 2 Mo au maximum.'
    debut = f.read(12); f.seek(0)
    if not debut.startswith(TYPES_IMAGES[ext]) or (ext == '.webp' and debut[8:12] != b'WEBP'):
        return 'Le fichier ne semble pas être une image valide.'
    return ''


def _entete(institution_id, dataset_id=None):
    """En-tête propre au formulaire s'il existe, sinon celui de l'organisation."""
    if dataset_id:
        e = EnTete.objects.filter(institution_id=institution_id, dataset_id=dataset_id).first()
        if e:
            return e, 'formulaire'
    e = EnTete.objects.filter(institution_id=institution_id, dataset_id__isnull=True).first()
    return e, ('organisation' if e else '')


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


@login_required
@require_http_methods(['GET'])
def en_tete_api(request):
    """GET /saisie-plus/api/en-tete/?institution=&dataset=  →  {ok, source, logo, logo_partenaire, lignes}"""
    inst, ds = _int(request.GET.get('institution')), _int(request.GET.get('dataset'))
    if not inst:
        return _erreur('Paramètre institution requis.')
    e, source = _entete(inst, ds)
    if not e:
        return JsonResponse({'ok': True, 'source': '', 'logo': None, 'logo_partenaire': None, 'lignes': []})
    org = EnTete.objects.filter(institution_id=inst, dataset_id__isnull=True).first() if source == 'formulaire' else None
    logo = e.logo or (org.logo if org else None)                       # un en-tête de formulaire sans logo garde celui de l'organisation
    logo2 = e.logo_partenaire or (org.logo_partenaire if org else None)
    return JsonResponse({'ok': True, 'source': source,
                         'logo': logo.url if logo else None,
                         'logo_partenaire': logo2.url if logo2 else None,
                         'lignes': [x for x in (e.ligne1, e.ligne2, e.ligne3) if x]})


@login_required
def en_tete_page(request):
    """Page de réglage : /saisie-plus/en-tete/?institution=<id>&dataset=<id facultatif>&retour=<url>"""
    inst, ds = _int(request.GET.get('institution') or request.POST.get('institution')), _int(request.GET.get('dataset') or request.POST.get('dataset'))
    retour = request.GET.get('retour') or request.POST.get('retour') or ''
    if not retour.startswith('/'):
        retour = ''                                                # pas de redirection vers un autre site
    if not inst:
        return _erreur('Paramètre institution requis.')
    portee = request.POST.get('portee') or ('formulaire' if ds and EnTete.objects.filter(institution_id=inst, dataset_id=ds).exists() else 'organisation')
    erreurs, ok = [], False

    if request.method == 'POST':
        cible_ds = ds if (portee == 'formulaire' and ds) else None
        e, _ = EnTete.objects.get_or_create(institution_id=inst, dataset_id=cible_ds)
        if request.POST.get('supprimer') == '1':
            for champ in ('logo', 'logo_partenaire'):
                if getattr(e, champ):
                    getattr(e, champ).delete(save=False)
            e.delete()
            return redirect(f"{request.path}?institution={inst}" + (f"&dataset={ds}" if ds else '') + (f"&retour={retour}" if retour else ''))
        for champ in ('logo', 'logo_partenaire'):
            f = request.FILES.get(champ)
            if f:
                msg = _image_valide(f)
                if msg:
                    erreurs.append(msg)
                    continue
                if getattr(e, champ):
                    getattr(e, champ).delete(save=False)            # on remplace l'ancien fichier
                setattr(e, champ, f)
            elif request.POST.get(champ + '_retirer') == '1' and getattr(e, champ):
                getattr(e, champ).delete(save=False)
                setattr(e, champ, None)
        e.ligne1 = (request.POST.get('ligne1') or '').strip()[:160]
        e.ligne2 = (request.POST.get('ligne2') or '').strip()[:160]
        e.ligne3 = (request.POST.get('ligne3') or '').strip()[:160]
        e.user = request.user
        e.save()
        ok = not erreurs

    e_form = EnTete.objects.filter(institution_id=inst, dataset_id=ds).first() if ds else None
    e_org = EnTete.objects.filter(institution_id=inst, dataset_id__isnull=True).first()
    courant = e_form if (portee == 'formulaire' and e_form) else e_org
    herite = courant is e_form and e_form is not None and e_org is not None      # logos manquants repris de l'organisation
    logo = (courant.logo if courant and courant.logo else (e_org.logo if herite and e_org.logo else None))
    logo2 = (courant.logo_partenaire if courant and courant.logo_partenaire else (e_org.logo_partenaire if herite and e_org.logo_partenaire else None))
    return render(request, 'saisie_plus/en_tete.html', {
        'institution': inst, 'dataset': ds, 'retour': retour, 'portee': portee,
        'e': courant, 'e_form': e_form, 'e_org': e_org, 'erreurs': erreurs, 'ok': ok,
        'logo_url': logo.url if logo else '', 'logo2_url': logo2.url if logo2 else '',
        'logo_herite': bool(herite and logo and not (courant and courant.logo)),
        'logo2_herite': bool(herite and logo2 and not (courant and courant.logo_partenaire)),
    })


# ======================================================================
#  Pièces jointes (champs « Fichier » et « Photo » du designer)
#  POST /saisie-plus/api/fichiers/            multipart {fichier, type, element, dataset, structure, periode}
#  GET  /saisie-plus/api/fichiers/<id>/       → {ok, fichier: {id, nom, taille, type, url, apercu}}
#  GET  /saisie-plus/fichier/<id>/            → le fichier lui-même, après contrôle des droits
# ======================================================================
from .models import PieceJointe  # noqa: E402

FORMATS_PIECES = {                      # extension → (début du contenu, type MIME, image ?)
    '.pdf': (b'%PDF', 'application/pdf', False),
    '.png': (b'\x89PNG', 'image/png', True),
    '.jpg': (b'\xff\xd8\xff', 'image/jpeg', True),
    '.jpeg': (b'\xff\xd8\xff', 'image/jpeg', True),
    '.webp': (b'RIFF', 'image/webp', True),
    '.docx': (b'PK\x03\x04', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', False),
    '.xlsx': (b'PK\x03\x04', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', False),
}
PIECE_MAX = 10 * 1024 * 1024            # 10 Mo


def _piece_valide(f, photo=False):
    import os
    ext = os.path.splitext(f.name)[1].lower()
    fmt = FORMATS_PIECES.get(ext)
    if not fmt or (photo and not fmt[2]):
        return None, ('Photo attendue : JPG, PNG ou WebP.' if photo else 'Formats acceptés : PDF, JPG, PNG, WebP, Word (.docx), Excel (.xlsx).')
    if f.size > PIECE_MAX:
        return None, 'Fichier trop lourd : 10 Mo au maximum.'
    debut = f.read(12); f.seek(0)
    if not debut.startswith(fmt[0]) or (ext == '.webp' and debut[8:12] != b'WEBP'):
        return None, 'Le contenu du fichier ne correspond pas à son extension.'
    return fmt, ''


def peut_voir_piece(user, piece):
    """Règle par défaut : l'auteur et l'équipe d'administration.
    Pour ouvrir aux superviseurs d'une unité, définir SAISIE_PLUS_PEUT_VOIR = 'module.fonction' dans settings
    (la fonction reçoit (user, piece) et renvoie True / False)."""
    from django.conf import settings
    from django.utils.module_loading import import_string
    if not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser or piece.auteur_id == user.id:
        return True
    chemin = getattr(settings, 'SAISIE_PLUS_PEUT_VOIR', '')
    return bool(chemin and import_string(chemin)(user, piece))


def info_piece(p):
    from django.urls import reverse
    url = reverse('saisie_plus:fichier', args=[p.id])
    return {'id': p.id, 'nom': p.nom, 'taille': p.taille, 'type': p.type_mime, 'url': url,
            'apercu': url + '?apercu=1' if p.est_image else None}


@login_required
@require_http_methods(['POST'])
def fichiers(request):
    import hashlib
    f = request.FILES.get('fichier')
    if not f:
        return _erreur('Aucun fichier reçu.')
    fmt, err = _piece_valide(f, photo=request.POST.get('type') == 'photo')
    if err:
        return _erreur(err)
    h = hashlib.sha256()
    for bloc in f.chunks():
        h.update(bloc)
    f.seek(0)
    deja = PieceJointe.objects.filter(auteur=request.user, sha256=h.hexdigest()).first()   # même fichier renvoyé : pas de doublon
    if deja:
        return JsonResponse({'ok': True, 'fichier': info_piece(deja)})
    p = PieceJointe(nom=f.name[:255], type_mime=fmt[1], taille=f.size, sha256=h.hexdigest(), est_image=fmt[2],
                    dataset_id=_int(request.POST.get('dataset')), structure_id=_int(request.POST.get('structure')),
                    periode=str(request.POST.get('periode') or '')[:64], element_id=_int(request.POST.get('element')),
                    auteur=request.user)
    p.fichier.save(f.name, f, save=False)
    p.save()
    return JsonResponse({'ok': True, 'fichier': info_piece(p)}, status=201)


@login_required
@require_http_methods(['GET'])
def fichier_info(request, piece_id):
    p = PieceJointe.objects.filter(id=piece_id).first()
    if not p or not peut_voir_piece(request.user, p):
        return _erreur('Pièce jointe introuvable.', 404)
    return JsonResponse({'ok': True, 'fichier': info_piece(p)})


@login_required
@require_http_methods(['GET'])
def fichier(request, piece_id):
    from django.http import FileResponse, Http404
    p = PieceJointe.objects.filter(id=piece_id).first()
    if not p or not peut_voir_piece(request.user, p):
        raise Http404
    try:
        fh = p.fichier.open('rb')
    except FileNotFoundError:
        raise Http404
    # images affichées dans la page ; les autres formats toujours téléchargés (jamais interprétés par le navigateur)
    r = FileResponse(fh, content_type=p.type_mime, as_attachment=not p.est_image, filename=p.nom)
    r['X-Content-Type-Options'] = 'nosniff'
    r['Content-Security-Policy'] = "default-src 'none'"
    r['Cache-Control'] = 'private, max-age=3600'
    return r


# ======================================================================
#  Indicateurs composites (indicateur calculé à partir d'autres indicateurs)
#  GET /saisie-plus/api/indicateurs/?institution=&exclure=   → catalogue pour l'éditeur de formule
#  GET /saisie-plus/api/formules/verifier/?formule=&indicateur= → erreurs (boucle, inconnu…) + formule développée
# ======================================================================
@login_required
@require_http_methods(['GET'])
def indicateurs_api(request):
    from .formules import champ_formule, _modele
    M = _modele()
    try:
        cf = champ_formule()
    except Exception:
        cf = None
    qs = M.objects.all()
    noms = {f.name for f in M._meta.get_fields()}
    inst = _int(request.GET.get('institution'))
    for champ in ('institution', 'm_institution'):
        if inst and champ in noms:
            qs = qs.filter(**{champ + '_id': inst}); break
    exclure = _int(request.GET.get('exclure'))
    if exclure:
        qs = qs.exclude(id=exclure)
    data = [{'id': o.id, 'nom': str(o), 'calcule': bool((getattr(o, cf, '') or '').strip()) if cf else False} for o in qs.order_by('id')[:2000]]
    return JsonResponse({'ok': True, 'indicateurs': data})


@login_required
@require_http_methods(['GET'])
def formules_verifier(request):
    from .formules import FormuleInvalide, developper, extraire, verifier
    f = request.GET.get('formule', '')[:4000]
    ind = _int(request.GET.get('indicateur'))
    erreurs = verifier(f, indicateur_id=ind)
    dev = ''
    if not erreurs:
        try:
            dev = developper(f)
        except FormuleInvalide as e:
            erreurs = [str(e)]
    return JsonResponse({'ok': not erreurs, 'erreurs': erreurs, 'developpee': dev,
                         'elements': sorted(set(extraire(dev)[0])) if dev else []})
