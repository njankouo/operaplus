"""
Application « archive » — vues de l'archivage numérique OPERAPLUS.
Toutes les vues renvoient des fragments HTML pour htmx (sauf exports et téléchargements).
"""
import csv
import io
import json
import os
import re
import tempfile
import zipfile
from datetime import timedelta

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import FieldError, PermissionDenied
from django.db import models, transaction as db_transaction
from django.db.models import Q
from django.http import FileResponse, HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_GET, require_POST

from .utils import (Doc, appliquer_extras, champ_cat, champ_date_ajout, champ_fichier, champ_sous_cat,
                              champ_sous_cat_vers_cat, champs_texte_archive, charger_regles, est_admin_archives,
                              famille, fiche_de, filtrer_institution, institution_de, journaliser, modele_archive,
                              modele_sous_cat, peut_modifier, peut_voir, presenter, sha256_de, synchroniser_fiche,
                              taille_lisible, type_mime)
from .models import SORTS, ArchiveFiche, ArchiveJournal, ArchivePartage, ArchiveVersion, RegleConservation

T = 'archive/'
def TAILLE_MAX():
    return int(getattr(settings, 'ARCHIVAGE_TAILLE_MAX_MO', 50)) * 1024 * 1024


# ============================================================ outils internes
def _qs(request):
    return filtrer_institution(modele_archive().objects.all(), request)


def _rel():
    sc, scc = champ_sous_cat(), champ_sous_cat_vers_cat()
    return [x for x in [sc.name if sc else None, (sc.name + '__' + scc.name) if (sc and scc) else None] if x]


def _ordre():
    cd = champ_date_ajout()
    return ['-' + cd.name, '-pk'] if cd else ['-pk']


def _charger(request, pk, modifier=False):
    a = get_object_or_404(_qs(request).select_related(*_rel()), pk=pk)
    fiche = fiche_de(a)
    charger_regles([fiche])
    if not peut_voir(request.user, fiche):
        raise PermissionDenied("Document confidentiel : accès non autorisé.")
    if modifier and not peut_modifier(request.user, fiche):
        raise PermissionDenied("Seul le déposant ou un administrateur des archives peut faire cette action.")
    return a, fiche


def _sous_cats(request):
    SC = modele_sous_cat()
    if SC is None:
        return []
    qs = SC.objects.all()
    inst = institution_de(request.user)
    scc = champ_sous_cat_vers_cat()
    if inst is not None:
        if 'institution' in {f.name for f in SC._meta.fields}:
            qs = qs.filter(institution=inst)
        elif scc is not None and 'institution' in {f.name for f in scc.related_model._meta.fields}:
            qs = qs.filter(**{scc.name + '__institution': inst})
    if scc is not None:
        qs = qs.select_related(scc.name).order_by(scc.name + '__nom', 'nom') if 'nom' in {f.name for f in SC._meta.fields} else qs.select_related(scc.name)
    return list(qs)


def _utilisateurs(request):
    U = get_user_model()
    qs = U.objects.filter(is_active=True)
    inst = institution_de(request.user)
    if inst is not None:
        try:
            qs = qs.filter(personnel__actual_institution=inst)
        except FieldError:
            pass
    return list(qs.order_by('last_name', 'first_name', 'username')[:300])


def _nom_fichier(doc, version=None):
    base = '%s - %s' % (doc.fiche.cote or 'ARC', doc.titre) if doc.fiche else doc.titre
    base = re.sub(r'[\\/:*?"<>|]+', ' ', base).strip()[:120]
    nom = version.fichier.name if version else doc.fichier.name
    return base + (' (v%d)' % version.numero if version else '') + os.path.splitext(nom)[1].lower()


def _reponse_detail(request, a, fiche, message='', niveau='ok', onglet=''):
    doc = Doc(a, fiche)
    admin = est_admin_archives(request.user)
    modif = peut_modifier(request.user, fiche)
    ctx = {
        'doc': doc, 'fiche': fiche, 'admin': admin, 'modif': modif,
        'grand': request.GET.get('grand') == '1' or request.POST.get('grand') == '1',
        'versions': ArchiveVersion.objects.filter(archive_id=a.pk),
        'journal': ArchiveJournal.objects.filter(archive_id=a.pk)[:40],
        'partages': [p for p in ArchivePartage.objects.filter(archive_id=a.pk, actif=True) if p.valide()],
        'message': message, 'niveau': niveau, 'onglet': onglet or request.POST.get('onglet', ''),
        'confidentialites': ArchiveFiche.CONFIDENTIALITE, 'sorts': SORTS,
        'durees': fiche.durees(), 'source_regle': fiche.source_regle(),
        'champs_archive': champs_texte_archive(),
        'types': TYPES_DOCUMENT,
    }
    if modif:
        ctx['utilisateurs'] = _utilisateurs(request)
        ctx['acces_ids'] = set(fiche.acces.values_list('pk', flat=True))
        ctx['sous_cats'] = _sous_cats(request)
    for p in ctx['partages']:
        p.url = request.build_absolute_uri(reverse('ar_partage_public', args=[p.jeton]))
    resp = render(request, T + '_detail.html', ctx)
    if message:
        resp['HX-Trigger'] = json.dumps({'arMaj': {'message': message, 'niveau': niveau}})
    return resp


TYPES_DOCUMENT = ['Rapport', 'Procès-verbal', 'Contrat / convention', 'Facture / pièce comptable', 'Liste de présence',
                  'Photo de terrain', 'Correspondance', 'Termes de référence', 'Fiche de collecte', 'Autre']


# ============================================================ consultation
@login_required
@require_GET
def ar_liste(request, pk):
    sc = champ_sous_cat()
    qs = _qs(request).filter(**{sc.attname: pk}).select_related(*_rel()).order_by(*_ordre())
    docs = [d for d in presenter(qs, request) if not d.fiche.supprime_le]
    return render(request, T + '_liste.html', {'docs': docs, 'sous_id': pk})


@login_required
@require_GET
def ar_detail(request, pk):
    a, fiche = _charger(request, pk)
    if fiche.supprime_le and not peut_modifier(request.user, fiche):
        raise PermissionDenied
    recent = ArchiveJournal.objects.filter(archive_id=pk, action='consultation', utilisateur=request.user,
                                           date__gte=timezone.now() - timedelta(minutes=10)).exists()
    if not recent:
        journaliser('consultation', fiche=fiche, titre=getattr(a, 'titre', ''), request=request)
    return _reponse_detail(request, a, fiche)


@login_required
@require_GET
@xframe_options_sameorigin
def ar_fichier(request, pk):
    a, fiche = _charger(request, pk)
    doc = Doc(a, fiche)
    version = None
    if request.GET.get('version'):
        version = get_object_or_404(ArchiveVersion, pk=request.GET['version'], archive_id=a.pk)
        f = version.fichier
    else:
        f = doc.fichier
    if not f:
        return HttpResponse("Aucun fichier n'est attaché à ce document.", status=404)
    telecharger = request.GET.get('telecharger') == '1'
    if telecharger:
        journaliser('telechargement', fiche=fiche, titre=doc.titre, request=request,
                    details={'version': version.numero if version else fiche.version_courante})
    try:
        flux = f.open('rb')
    except (FileNotFoundError, OSError):
        return HttpResponse("Fichier introuvable sur le serveur : lancez un contrôle d'intégrité.", status=404)
    return FileResponse(flux, as_attachment=telecharger, filename=_nom_fichier(doc, version),
                        content_type=type_mime(f.name))


# ============================================================ modification
@login_required
@require_POST
def ar_fiche(request, pk):
    a, fiche = _charger(request, pk, modifier=True)
    P = request.POST
    avant = {'fiche': {c: str(getattr(fiche, c)) for c in ('type_document', 'date_document', 'lieu', 'langue', 'mots_cles', 'confidentialite', 'dua_active', 'dua_intermediaire', 'sort_final')},
             'archive': {c: getattr(a, c, '') for c in champs_texte_archive()}}
    maj_archive = []
    for c in champs_texte_archive():
        if c in P:
            v = P.get(c, '').strip()
            if c == 'titre' and not v:
                return _reponse_detail(request, a, fiche, 'Le titre est obligatoire.', 'erreur', 'fiche')
            if v != (getattr(a, c) or ''):
                setattr(a, c, v)
                maj_archive.append(c)
    appliquer_extras(fiche, P, prefixe='')
    def entier(n):
        v = (P.get(n) or '').strip()
        return int(v) if v.isdigit() else None
    if 'dua_active' in P:
        fiche.dua_active, fiche.dua_intermediaire = entier('dua_active'), entier('dua_intermediaire')
        fiche.sort_final = P.get('sort_final', '') if P.get('sort_final', '') in dict(SORTS) else ''
    with db_transaction.atomic():
        if maj_archive:
            a._ar_silencieux = True
            a.save(update_fields=maj_archive)
        fiche.save()
        if 'acces' in P or P.get('acces_envoye'):
            fiche.acces.set([int(x) for x in P.getlist('acces') if x.isdigit()])
    apres = {'fiche': {c: str(getattr(fiche, c)) for c in avant['fiche']}, 'archive': {c: getattr(a, c, '') for c in champs_texte_archive()}}
    changes = [k for k in avant['fiche'] if avant['fiche'][k] != apres['fiche'][k]] + [k for k in avant['archive'] if avant['archive'][k] != apres['archive'][k]]
    if changes:
        journaliser('modification', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'champs': changes})
    fiche._regle = 'x'
    return _reponse_detail(request, a, fiche, 'Fiche enregistrée.' if changes else 'Aucun changement.', 'ok', P.get('onglet', 'fiche'))


@login_required
@require_POST
def ar_version(request, pk):
    a, fiche = _charger(request, pk, modifier=True)
    if fiche.gel_juridique:
        return _reponse_detail(request, a, fiche, 'Document sous gel juridique : aucune nouvelle version possible.', 'erreur', 'versions')
    up = request.FILES.get('fichier')
    if not up:
        return _reponse_detail(request, a, fiche, 'Choisissez le fichier de la nouvelle version.', 'erreur', 'versions')
    if up.size > TAILLE_MAX():
        return _reponse_detail(request, a, fiche, 'Fichier trop lourd (%s).' % taille_lisible(up.size), 'erreur', 'versions')
    champ = champ_fichier().name
    actuel = getattr(a, champ)
    commentaire = request.POST.get('commentaire', '').strip()[:255]
    with db_transaction.atomic():
        n = fiche.version_courante
        if actuel:
            ArchiveVersion.objects.create(archive_id=a.pk, numero=n, fichier=actuel.name, nom_original=os.path.basename(actuel.name),
                                          sha256=fiche.sha256, taille=fiche.taille, commentaire=fiche.commentaire_version,
                                          cree_par=fiche.depose_par if n == 1 else None)
        getattr(a, champ).save(up.name, up, save=False)
        if 'format' in {f.name for f in a._meta.fields} and famille(up.name) in ('pdf', 'image'):
            a.format = famille(up.name)
        a._ar_silencieux = True
        a.save()
        fiche.refresh_from_db()
        fiche.version_courante = n + 1
        fiche.commentaire_version = commentaire
        fiche.save(update_fields=['version_courante', 'commentaire_version'])
    journaliser('nouvelle_version', fiche=fiche, titre=getattr(a, 'titre', ''), request=request,
                details={'version': n + 1, 'sha256': fiche.sha256, 'commentaire': commentaire})
    return _reponse_detail(request, a, fiche, 'Version %d enregistrée. L’ancienne reste consultable.' % (n + 1), 'ok', 'versions')


@login_required
@require_POST
def ar_version_restaurer(request, pk):
    v = get_object_or_404(ArchiveVersion, pk=pk)
    a, fiche = _charger(request, v.archive_id, modifier=True)
    if fiche.gel_juridique:
        return _reponse_detail(request, a, fiche, 'Document sous gel juridique.', 'erreur', 'versions')
    champ = champ_fichier().name
    actuel = getattr(a, champ)
    with db_transaction.atomic():
        n = fiche.version_courante
        if actuel:
            ArchiveVersion.objects.create(archive_id=a.pk, numero=n, fichier=actuel.name, nom_original=os.path.basename(actuel.name),
                                          sha256=fiche.sha256, taille=fiche.taille, commentaire=fiche.commentaire_version)
        setattr(a, champ, v.fichier.name)
        a._ar_silencieux = True
        a.save()
        fiche.refresh_from_db()
        fiche.version_courante = n + 1
        fiche.commentaire_version = 'Restauration de la version %d' % v.numero
        fiche.save(update_fields=['version_courante', 'commentaire_version'])
    journaliser('restauration_version', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'depuis': v.numero, 'version': n + 1})
    return _reponse_detail(request, a, fiche, 'La version %d est redevenue la version courante (v%d).' % (v.numero, n + 1), 'ok', 'versions')


@login_required
@require_POST
def ar_integrite(request, pk):
    a, fiche = _charger(request, pk)
    ok, msg = _verifier(a, fiche, request)
    return _reponse_detail(request, a, fiche, msg, 'ok' if ok else 'erreur', request.POST.get('onglet', ''))


def _verifier(a, fiche, request=None):
    f = getattr(a, champ_fichier().name)
    try:
        empreinte, taille = sha256_de(f)
    except Exception:
        empreinte, taille = None, 0
    if empreinte is None:
        ok, msg = False, 'Fichier introuvable sur le serveur !'
    elif not fiche.sha256:
        fiche.sha256, fiche.taille = empreinte, taille
        ok, msg = True, 'Empreinte enregistrée (premier contrôle).'
    else:
        ok = empreinte == fiche.sha256
        msg = 'Intégrité confirmée : le fichier n’a pas été modifié.' if ok else 'ALERTE : le fichier a été modifié depuis son dépôt.'
    fiche.integrite_ok, fiche.integrite_verifiee_le = ok, timezone.now()
    fiche.save(update_fields=['integrite_ok', 'integrite_verifiee_le', 'sha256', 'taille'])
    journaliser('integrite', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'resultat': 'ok' if ok else 'altere', 'calcule': empreinte})
    return ok, msg


@login_required
@require_POST
def ar_gel(request, pk):
    a, fiche = _charger(request, pk)
    if not est_admin_archives(request.user):
        raise PermissionDenied
    if fiche.gel_juridique:
        fiche.gel_juridique, fiche.gel_motif = False, ''
        action, msg = 'degel', 'Gel juridique levé.'
    else:
        motif = request.POST.get('motif', '').strip()
        if not motif:
            return _reponse_detail(request, a, fiche, 'Indiquez le motif du gel (audit, litige, enquête…).', 'erreur', 'conservation')
        fiche.gel_juridique, fiche.gel_motif = True, motif[:255]
        action, msg = 'gel', 'Document gelé : il ne peut plus être modifié ni éliminé.'
    fiche.save(update_fields=['gel_juridique', 'gel_motif'])
    journaliser(action, fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'motif': fiche.gel_motif})
    return _reponse_detail(request, a, fiche, msg, 'ok', 'conservation')


@login_required
@require_POST
def ar_partager(request, pk):
    a, fiche = _charger(request, pk)
    if fiche.confidentialite == 'restreint':
        return _reponse_detail(request, a, fiche, 'Un document « Restreint » ne peut pas être partagé par lien.', 'erreur', 'partage')
    try:
        jours = max(1, min(90, int(request.POST.get('jours', 7))))
    except ValueError:
        jours = 7
    mx = request.POST.get('max', '').strip()
    p = ArchivePartage.objects.create(archive_id=a.pk, cree_par=request.user, destinataire=request.POST.get('destinataire', '').strip()[:150],
                                      expire_le=timezone.now() + timedelta(days=jours), telechargements_max=int(mx) if mx.isdigit() and int(mx) > 0 else None)
    journaliser('partage', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'jours': jours, 'destinataire': p.destinataire, 'lien': p.pk})
    return _reponse_detail(request, a, fiche, 'Lien créé, valable %d jour%s. Copiez-le ci-dessous.' % (jours, 's' if jours > 1 else ''), 'ok', 'partage')


@login_required
@require_POST
def ar_partage_revoquer(request, pk):
    p = get_object_or_404(ArchivePartage, pk=pk)
    a, fiche = _charger(request, p.archive_id)
    if not (est_admin_archives(request.user) or p.cree_par_id == request.user.id or peut_modifier(request.user, fiche)):
        raise PermissionDenied
    p.actif = False
    p.save(update_fields=['actif'])
    journaliser('partage_revoque', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'lien': p.pk})
    return _reponse_detail(request, a, fiche, 'Lien révoqué : il ne fonctionne plus.', 'ok', 'partage')


def ar_partage_public(request, jeton):
    p = ArchivePartage.objects.filter(jeton=jeton).first()
    if p is None or not p.valide():
        return render(request, T + 'partage_expire.html', status=410)
    a = modele_archive().objects.filter(pk=p.archive_id).first()
    fiche = ArchiveFiche.objects.filter(archive_id=p.archive_id).first()
    if a is None or (fiche and (fiche.supprime_le or fiche.confidentialite == 'restreint')):
        return render(request, T + 'partage_expire.html', status=410)
    f = getattr(a, champ_fichier().name)
    p.telechargements += 1
    p.save(update_fields=['telechargements'])
    journaliser('telechargement_partage', fiche=fiche, archive_id=a.pk, titre=getattr(a, 'titre', ''), request=request,
                details={'lien': p.pk, 'destinataire': p.destinataire}, user=None)
    return FileResponse(f.open('rb'), as_attachment=True, filename=_nom_fichier(Doc(a, fiche)), content_type=type_mime(f.name))


# ============================================================ corbeille / élimination
@login_required
@require_POST
def ar_corbeille_mettre(request, pk):
    a, fiche = _charger(request, pk, modifier=True)
    msg = _mettre_corbeille(request, a, fiche, request.POST.get('motif', ''))
    return _reponse_detail(request, a, fiche, msg[1], 'ok' if msg[0] else 'erreur')


def _mettre_corbeille(request, a, fiche, motif):
    if fiche.gel_juridique:
        return False, 'Document sous gel juridique : suppression impossible.'
    fiche.supprime_le, fiche.supprime_par, fiche.motif_suppression = timezone.now(), request.user, (motif or '').strip()[:255]
    fiche.save(update_fields=['supprime_le', 'supprime_par', 'motif_suppression'])
    journaliser('corbeille', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'motif': fiche.motif_suppression})
    return True, 'Document placé dans la corbeille (restaurable pendant %d jours).' % _jours_corbeille()


def _jours_corbeille():
    return int(getattr(settings, 'ARCHIVAGE_CORBEILLE_JOURS', 30))


@login_required
@require_POST
def ar_restaurer(request, pk):
    a, fiche = _charger(request, pk, modifier=True)
    fiche.supprime_le, fiche.supprime_par, fiche.motif_suppression = None, None, ''
    fiche.save(update_fields=['supprime_le', 'supprime_par', 'motif_suppression'])
    journaliser('restauration', fiche=fiche, titre=getattr(a, 'titre', ''), request=request)
    if request.POST.get('depuis') == 'corbeille':
        return _corbeille(request, message='« %s » restauré.' % getattr(a, 'titre', ''))
    return _reponse_detail(request, a, fiche, 'Document restauré.', 'ok')


def _eliminer(request, a, fiche, motif):
    if fiche.gel_juridique:
        return False
    noms = {(champ_fichier().storage, getattr(a, champ_fichier().name).name)} if getattr(a, champ_fichier().name) else set()
    for v in ArchiveVersion.objects.filter(archive_id=a.pk):
        noms.add((v.fichier.storage, v.fichier.name))
    journaliser('elimination', fiche=fiche, titre=getattr(a, 'titre', ''), request=request,
                details={'motif': motif, 'sha256': fiche.sha256, 'taille': fiche.taille, 'phase': fiche.phase()[1], 'versions': fiche.version_courante})
    with db_transaction.atomic():
        ArchiveVersion.objects.filter(archive_id=a.pk).delete()
        ArchivePartage.objects.filter(archive_id=a.pk).delete()
        a._ar_elimine = True
        a.delete()
        fiche.delete()
    for stockage, nom in noms:
        try:
            if nom and not ArchiveVersion.objects.filter(fichier=nom).exists():
                stockage.delete(nom)
        except Exception:
            pass
    return True


@login_required
@require_POST
def ar_eliminer(request, pk):
    if not est_admin_archives(request.user):
        raise PermissionDenied
    a, fiche = _charger(request, pk)
    motif = request.POST.get('motif', '').strip()
    if not motif:
        return HttpResponseBadRequest('Motif obligatoire.')
    titre = getattr(a, 'titre', '')
    if not _eliminer(request, a, fiche, motif):
        return _reponse_detail(request, a, fiche, 'Document sous gel juridique : élimination impossible.', 'erreur')
    resp = render(request, T + '_elimine.html', {'titre': titre})
    resp['HX-Trigger'] = json.dumps({'arMaj': {'message': '« %s » éliminé définitivement.' % titre, 'niveau': 'ok'}})
    return resp


@login_required
@require_GET
def ar_corbeille(request):
    return _corbeille(request)


def _corbeille(request, message=''):
    ids_vis = _qs(request).values_list('pk', flat=True)
    fiches = ArchiveFiche.objects.filter(supprime_le__isnull=False, archive_id__in=list(ids_vis)).select_related('supprime_par')
    archives = {a.pk: a for a in modele_archive().objects.filter(pk__in=[f.archive_id for f in fiches]).select_related(*_rel())}
    docs = []
    limite = _jours_corbeille()
    for f in fiches.order_by('-supprime_le'):
        if f.archive_id in archives and peut_voir(request.user, f):
            d = Doc(archives[f.archive_id], f)
            d.jours_restants = max(0, limite - (timezone.now() - f.supprime_le).days)
            d.peut = peut_modifier(request.user, f)
            docs.append(d)
    resp = render(request, T + '_corbeille.html', {'docs': docs, 'admin': est_admin_archives(request.user), 'jours': limite, 'message': message})
    if message:
        resp['HX-Trigger'] = json.dumps({'arMaj': {'message': message, 'niveau': 'ok'}})
    return resp


# ============================================================ recherche, tableau de bord, exports
def _recherche_docs(request, p):
    q = (p.get('q') or '').strip()
    qs = _qs(request).select_related(*_rel())
    sc, scc = champ_sous_cat(), champ_sous_cat_vers_cat()
    ids_sel = [int(x) for x in (p.get('ids') or '').split(',') if x.strip().isdigit()]
    if ids_sel:
        qs = qs.filter(pk__in=ids_sel)
    if p.get('sous', '').isdigit() and sc:
        qs = qs.filter(**{sc.attname: p['sous']})
    if p.get('cat', '').isdigit() and sc and scc:
        qs = qs.filter(**{sc.name + '__' + scc.attname: p['cat']})
    if q:
        cond = Q()
        for n in champs_texte_archive():
            cond |= Q(**{n + '__icontains': q})
        ids = ArchiveFiche.objects.filter(Q(cote__icontains=q) | Q(mots_cles__icontains=q) | Q(texte_extrait__icontains=q)
                                          | Q(lieu__icontains=q) | Q(type_document__icontains=q)).values_list('archive_id', flat=True)
        qs = qs.filter(cond | Q(pk__in=list(ids)))
    if p.get('annee', '').isdigit():
        an = int(p['annee'])
        cd = champ_date_ajout()
        ids = list(ArchiveFiche.objects.filter(date_document__year=an).values_list('archive_id', flat=True))
        qs = qs.filter(Q(pk__in=ids) | (Q(**{cd.name + '__year': an}) if cd else Q(pk__in=ids)))
    docs = [d for d in presenter(qs.order_by(*_ordre())[:1000], request) if not d.fiche.supprime_le]
    if p.get('phase'):
        docs = [d for d in docs if d.phase[0] == p['phase']]
    if p.get('conf'):
        docs = [d for d in docs if d.fiche.confidentialite == p['conf']]
    if p.get('format'):
        docs = [d for d in docs if d.famille == p['format']]
    if p.get('type'):
        docs = [d for d in docs if d.fiche.type_document == p['type']]
    if q:
        ql = q.lower()
        for d in docs:
            t = d.fiche.texte_extrait or ''
            i = t.lower().find(ql)
            if i >= 0 and ql not in d.titre.lower():
                d.extrait = ('…' if i > 60 else '') + t[max(0, i - 60):i + 100] + '…'
    tri = p.get('tri', '')
    if tri == 'titre':
        docs.sort(key=lambda d: d.titre.lower())
    elif tri == 'cote':
        docs.sort(key=lambda d: d.fiche.cote or '')
    elif tri == 'echeance':
        docs.sort(key=lambda d: (d.fiche.prochaine_echeance() is None, d.fiche.prochaine_echeance() or timezone.localdate()))
    return docs, q


@login_required
@require_GET
def ar_recherche(request):
    docs, q = _recherche_docs(request, request.GET)
    params = request.GET.copy()
    return render(request, T + '_recherche.html', {'docs': docs[:300], 'total': len(docs), 'q': q, 'params': params.urlencode(),
                                                    'phase': request.GET.get('phase', ''), 'tronque': len(docs) > 300})


@login_required
@require_GET
def ar_tableau(request):
    return _tableau(request)


def _tableau(request):
    A = modele_archive()
    ids = list(_qs(request).values_list('pk', flat=True))
    fiches = list(ArchiveFiche.objects.filter(archive_id__in=ids))
    charger_regles(fiches)
    sans_fiche = len(ids) - len(fiches)
    vivantes = [f for f in fiches if not f.supprime_le and peut_voir(request.user, f)]
    phases = {}
    for f in vivantes:
        f.ph = f.phase()
        phases[f.ph[0]] = phases.get(f.ph[0], 0) + 1
    n = len(vivantes) or 1
    ordre = [('actif', 'Actif', '#2563eb'), ('intermediaire', 'Intermédiaire', '#7c3aed'), ('definitif', 'Définitif', '#0f766e'),
             ('a_trier', 'À trier', '#d97706'), ('a_eliminer', 'À éliminer', '#dc2626'), ('gel', 'Gel juridique', '#475569')]
    cycle = [{'code': c, 'nom': nm, 'couleur': col, 'n': phases.get(c, 0), 'pct': round(phases.get(c, 0) * 100 / n, 1)} for c, nm, col in ordre]
    limite = timezone.localdate() + timedelta(days=90)
    proches = sorted([f for f in vivantes if f.ph[0] in ('actif', 'intermediaire') and f.prochaine_echeance() and f.prochaine_echeance() <= limite],
                     key=lambda f: f.prochaine_echeance())[:6]
    titres = dict(A.objects.filter(pk__in=[f.archive_id for f in proches]).values_list('pk', 'titre')) if 'titre' in {x.name for x in A._meta.fields} else {}
    for f in proches:
        f.titre = titres.get(f.archive_id, 'Document %s' % f.archive_id)
        f.jours = (f.prochaine_echeance() - timezone.localdate()).days
        f.passage = 'Intermédiaire' if f.ph[0] == 'actif' else f.sort_final_effectif_display()
    il_y_a = timezone.now() - timedelta(days=180)
    qualite = {
        'mots_cles': round(sum(1 for f in vivantes if f.mots_cles.strip()) * 100 / n),
        'date_doc': round(sum(1 for f in vivantes if f.date_document) * 100 / n),
        'controle': round(sum(1 for f in vivantes if f.integrite_verifiee_le and f.integrite_verifiee_le >= il_y_a) * 100 / n),
    }
    ctx = {
        'total': len(vivantes), 'volume': taille_lisible(sum(f.taille for f in vivantes)), 'cycle': cycle,
        'proches': proches, 'qualite': qualite, 'alteres': sum(1 for f in vivantes if f.integrite_ok is False),
        'corbeille': sum(1 for f in fiches if f.supprime_le), 'sans_fiche': sans_fiche,
        'confidentiels': sum(1 for f in vivantes if f.confidentialite in ('confidentiel', 'restreint')),
        'gel': phases.get('gel', 0), 'a_eliminer': phases.get('a_eliminer', 0), 'a_trier': phases.get('a_trier', 0),
        'activite': ArchiveJournal.objects.filter(Q(archive_id__in=ids) | Q(archive_id__isnull=True)).exclude(action='consultation')[:8],
        'admin': est_admin_archives(request.user), 'vide': not vivantes,
    }
    return render(request, T + '_tableau.html', ctx)


COLONNES = ['Cote', 'Titre', 'Dossier', 'Sous-dossier', 'Type', 'Date du document', 'Date de dépôt', 'Auteur', 'Provenance',
            'Source de financement', 'Confidentialité', 'Phase', 'Fin période active', 'Fin période intermédiaire', 'Sort final',
            'Version', 'Taille (octets)', 'Empreinte SHA-256', 'Mots-clés']


def _ligne_inventaire(d):
    f = d.fiche
    return [f.cote or '', d.titre, getattr(d.cat, 'nom', ''), getattr(d.sous_cat, 'nom', ''), f.type_document,
            f.date_document.strftime('%d/%m/%Y') if f.date_document else '',
            timezone.localtime(d.date_ajout).strftime('%d/%m/%Y') if hasattr(d.date_ajout, 'tzinfo') and d.date_ajout else '',
            d.auteur, d.provenance, d.source_financement, f.get_confidentialite_display(), d.phase[1],
            f.fin_active().strftime('%d/%m/%Y'), f.fin_intermediaire().strftime('%d/%m/%Y'), f.sort_final_effectif_display(),
            f.version_courante, f.taille, f.sha256, f.mots_cles]


@login_required
@require_GET
def ar_inventaire(request):
    docs, _ = _recherche_docs(request, request.GET)
    out = io.StringIO()
    out.write('﻿')
    w = csv.writer(out, delimiter=';')
    w.writerow(COLONNES)
    for d in docs:
        w.writerow(_ligne_inventaire(d))
    journaliser('export', request=request, titre='Inventaire CSV', details={'documents': len(docs), 'filtres': request.GET.dict()})
    resp = HttpResponse(out.getvalue(), content_type='text/csv; charset=utf-8')
    resp['Content-Disposition'] = 'attachment; filename="inventaire_archives_%s.csv"' % timezone.localdate().strftime('%Y%m%d')
    return resp


@login_required
@require_GET
def ar_bordereau(request):
    p = request.GET.copy()
    p['phase'] = 'a_eliminer'
    docs, _ = _recherche_docs(request, p)
    if request.GET.get('trier') == '1':
        p['phase'] = 'a_trier'
        docs += _recherche_docs(request, p)[0]
    return render(request, T + 'bordereau.html', {'docs': docs, 'admin': est_admin_archives(request.user), 'date': timezone.localdate(),
                                                   'institution': institution_de(request.user), 'volume': taille_lisible(sum(d.fiche.taille for d in docs)),
                                                   'trier': request.GET.get('trier') == '1'})


# ============================================================ actions en lot
def _ids(request):
    src = request.POST if request.method == 'POST' else request.GET
    brut = [x for v in src.getlist('ids') for x in str(v).split(',')]
    return [int(x) for x in brut if x.strip().isdigit()]


@login_required
@require_POST
def ar_lot(request):
    action = request.POST.get('action')
    ids = _ids(request)
    if not ids:
        return JsonResponse({'ok': False, 'message': 'Aucun document sélectionné.'}, status=400)
    archives = list(_qs(request).filter(pk__in=ids).select_related(*_rel()))
    faits, refus = 0, 0
    sc = champ_sous_cat()
    cible = None
    if action == 'deplacer':
        cible = next((s for s in _sous_cats(request) if str(s.pk) == request.POST.get('sous_categorie')), None)
        if cible is None:
            return JsonResponse({'ok': False, 'message': 'Choisissez le sous-dossier de destination.'}, status=400)
    if action == 'eliminer' and not est_admin_archives(request.user):
        raise PermissionDenied
    motif = request.POST.get('motif', '').strip()
    if action == 'eliminer' and not motif:
        return JsonResponse({'ok': False, 'message': 'Motif obligatoire pour une élimination.'}, status=400)
    for a in archives:
        fiche = fiche_de(a)
        if not peut_voir(request.user, fiche) or (action != 'eliminer' and not peut_modifier(request.user, fiche)):
            refus += 1
            continue
        if action == 'deplacer':
            setattr(a, sc.attname, cible.pk)
            cf, scc = champ_cat(), champ_sous_cat_vers_cat()
            champs = [sc.attname]
            if cf is not None and scc is not None:
                setattr(a, cf.attname, getattr(cible, scc.attname))
                champs.append(cf.attname)
            a._ar_silencieux = True
            a.save(update_fields=champs)
            journaliser('deplacement', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'vers': str(cible)})
        elif action == 'mots_cles':
            ajout = [m.strip() for m in request.POST.get('mots_cles', '').split(',') if m.strip()]
            fiche.mots_cles = ', '.join(dict.fromkeys(fiche.liste_mots_cles() + ajout))[:400]
            fiche.save(update_fields=['mots_cles'])
            journaliser('modification', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'champs': ['mots_cles'], 'lot': True})
        elif action == 'confidentialite' and request.POST.get('valeur') in dict(ArchiveFiche.CONFIDENTIALITE):
            fiche.confidentialite = request.POST['valeur']
            fiche.save(update_fields=['confidentialite'])
            journaliser('modification', fiche=fiche, titre=getattr(a, 'titre', ''), request=request, details={'champs': ['confidentialite'], 'lot': True})
        elif action == 'corbeille':
            if not _mettre_corbeille(request, a, fiche, motif or 'Suppression en lot')[0]:
                refus += 1
                continue
        elif action == 'restaurer':
            fiche.supprime_le = None
            fiche.save(update_fields=['supprime_le'])
            journaliser('restauration', fiche=fiche, titre=getattr(a, 'titre', ''), request=request)
        elif action == 'eliminer':
            if not _eliminer(request, a, fiche, motif):
                refus += 1
                continue
        else:
            return JsonResponse({'ok': False, 'message': 'Action inconnue.'}, status=400)
        faits += 1
    msg = '%d document%s traité%s.' % (faits, 's' if faits > 1 else '', 's' if faits > 1 else '') + (' %d refusé%s (droits ou gel juridique).' % (refus, 's' if refus > 1 else '') if refus else '')
    if request.POST.get('retour'):
        messages.success(request, msg)
        return redirect(request.POST['retour'])
    return JsonResponse({'ok': True, 'message': msg, 'faits': faits, 'refus': refus})


@login_required
@require_GET
def ar_lot_zip(request):
    archives = list(_qs(request).filter(pk__in=_ids(request)).select_related(*_rel()))
    docs = [d for d in presenter(archives, request) if not d.fiche.supprime_le]
    if not docs:
        return HttpResponse('Aucun document à exporter.', status=404)
    tmp = tempfile.SpooledTemporaryFile(max_size=50 * 1024 * 1024)
    manifeste = io.StringIO()
    w = csv.writer(manifeste, delimiter=';')
    w.writerow(['Fichier'] + COLONNES)
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        for d in docs:
            if not d.fichier:
                continue
            nom = _nom_fichier(d)
            try:
                with d.fichier.open('rb') as fh:
                    z.writestr(nom, fh.read())
            except Exception:
                continue
            w.writerow([nom] + _ligne_inventaire(d))
            journaliser('export', fiche=d.fiche, titre=d.titre, request=request, details={'format': 'zip'})
        z.writestr('MANIFESTE_inventaire.csv', '﻿' + manifeste.getvalue())
    tmp.seek(0)
    return FileResponse(tmp, as_attachment=True, filename='archives_%s.zip' % timezone.localdate().strftime('%Y%m%d'), content_type='application/zip')


# ============================================================ dépôt multiple
def creer_archive(request, fichier, sous_cat, meta):
    """Crée une archive dans VOTRE modèle existant (champs détectés automatiquement)."""
    A = modele_archive()
    champs = {f.name: f for f in A._meta.concrete_fields}
    kw = {}

    def mettre(n, v):
        if n in champs and v not in (None, ''):
            kw[n] = v
    titre = (meta.get('titre') or '').strip() or re.sub(r'[_-]+', ' ', os.path.splitext(fichier.name)[0]).strip()
    perso = getattr(request.user, 'personnel', None)
    mettre('titre', titre[:champs['titre'].max_length or 255] if 'titre' in champs else titre)
    mettre('auteur', (meta.get('auteur') or str(perso or request.user.get_full_name() or request.user.username)).strip())
    for n in ('description', 'source_financement', 'provenance'):
        mettre(n, (meta.get(n) or '').strip())
    if famille(fichier.name) in ('pdf', 'image'):
        mettre('format', famille(fichier.name))
    sc, scc, cf = champ_sous_cat(), champ_sous_cat_vers_cat(), champ_cat()
    kw[sc.name] = sous_cat
    if cf is not None and scc is not None:
        kw[cf.attname] = getattr(sous_cat, scc.attname)
    U = get_user_model()
    for f in A._meta.concrete_fields:
        if f.is_relation and f.many_to_one and f.name not in kw and f.attname not in kw and not f.null and not f.has_default():
            if f.related_model is U:
                kw[f.name] = request.user
            elif perso is not None and f.related_model is type(perso):
                kw[f.name] = perso
            elif 'institution' in f.name and institution_de(request.user) is not None:
                kw[f.name] = institution_de(request.user)
    for f in A._meta.concrete_fields:
        if isinstance(f, (models.CharField, models.TextField)) and f.name not in kw and not f.null and not f.has_default() and not f.primary_key:
            kw[f.name] = ''
    obj = A(**kw)
    getattr(obj, champ_fichier().name).save(os.path.basename(fichier.name), fichier, save=False)
    obj.save()
    return obj


@login_required
@require_POST
def ar_deposer(request):
    sc_id = request.POST.get('sous_categorie', '')
    cible = next((s for s in _sous_cats(request) if str(s.pk) == sc_id), None)
    if cible is None:
        return JsonResponse({'ok': False, 'message': 'Choisissez le sous-dossier où ranger les fichiers.'}, status=400)
    fichiers = request.FILES.getlist('fichiers')
    if not fichiers:
        return JsonResponse({'ok': False, 'message': 'Aucun fichier reçu.'}, status=400)
    titres = request.POST.getlist('titres')
    resultats = []
    for i, f in enumerate(fichiers):
        if f.size > TAILLE_MAX():
            resultats.append({'nom': f.name, 'ok': False, 'message': 'trop lourd (%s)' % taille_lisible(f.size)})
            continue
        meta = {k: request.POST.get(k, '') for k in ('description', 'source_financement', 'provenance', 'auteur')}
        meta['titre'] = titres[i] if i < len(titres) else ''
        try:
            with db_transaction.atomic():
                obj = creer_archive(request, f, cible, meta)
            fiche = ArchiveFiche.objects.filter(archive_id=obj.pk).first()
            resultats.append({'nom': f.name, 'ok': True, 'id': obj.pk, 'cote': fiche.cote if fiche else ''})
        except Exception as e:  # on continue avec les autres fichiers
            resultats.append({'nom': f.name, 'ok': False, 'message': str(e)[:160]})
    n = sum(1 for r in resultats if r['ok'])
    return JsonResponse({'ok': n > 0, 'message': '%d fichier%s archivé%s sur %d.' % (n, 's' if n > 1 else '', 's' if n > 1 else '', len(fichiers)),
                         'resultats': resultats, 'sous_categorie': cible.pk})


# ============================================================ administration
@login_required
def ar_regles(request):
    admin = est_admin_archives(request.user)
    sous = _sous_cats(request)
    regles = {r.sous_categorie_id: r for r in RegleConservation.objects.filter(sous_categorie_id__in=[s.pk for s in sous])}
    message = ''
    if request.method == 'POST':
        if not admin:
            raise PermissionDenied
        n = 0
        for s in sous:
            a, i, so = (request.POST.get('a_%d' % s.pk, '').strip(), request.POST.get('i_%d' % s.pk, '').strip(), request.POST.get('s_%d' % s.pk, ''))
            if not (a.isdigit() and i.isdigit() and so in dict(SORTS)):
                continue
            r = regles.get(s.pk) or RegleConservation(sous_categorie_id=s.pk)
            if (r.pk is None) or (r.dua_active, r.dua_intermediaire, r.sort_final) != (int(a), int(i), so):
                r.dua_active, r.dua_intermediaire, r.sort_final, r.maj_par = int(a), int(i), so, request.user
                r.save()
                regles[s.pk] = r
                n += 1
        if n:
            journaliser('regle', request=request, titre='Règles de conservation', details={'modifiees': n})
        message = '%d règle%s enregistrée%s.' % (n, 's' if n > 1 else '', 's' if n > 1 else '') if n else 'Aucun changement.'
    d = getattr(settings, 'ARCHIVAGE_DUA_DEFAUT', (2, 5, 'trier'))
    scc = champ_sous_cat_vers_cat()
    lignes = [{'s': s, 'cat': getattr(s, scc.name, None) if scc else None, 'r': regles.get(s.pk)} for s in sous]
    resp = render(request, T + '_regles.html', {'lignes': lignes, 'admin': admin, 'sorts': SORTS, 'defaut': d, 'message': message})
    if message:
        resp['HX-Trigger'] = json.dumps({'arMaj': {'message': message, 'niveau': 'ok'}})
    return resp


@login_required
@require_GET
def ar_journal(request):
    if not est_admin_archives(request.user):
        raise PermissionDenied
    ids = list(_qs(request).values_list('pk', flat=True))
    qs = ArchiveJournal.objects.filter(Q(archive_id__in=ids) | Q(archive_id__isnull=True) | Q(action__in=['elimination', 'suppression_externe']))
    if request.GET.get('action'):
        qs = qs.filter(action=request.GET['action'])
    if request.GET.get('q'):
        qq = request.GET['q']
        qs = qs.filter(Q(titre__icontains=qq) | Q(cote__icontains=qq) | Q(nom_utilisateur__icontains=qq))
    if request.GET.get('format') == 'csv':
        out = io.StringIO()
        out.write('﻿')
        w = csv.writer(out, delimiter=';')
        w.writerow(['Date', 'Action', 'Cote', 'Titre', 'Utilisateur', 'Adresse IP', 'Détails'])
        for j in qs[:20000]:
            w.writerow([timezone.localtime(j.date).strftime('%d/%m/%Y %H:%M'), j.get_action_display(), j.cote, j.titre, j.nom_utilisateur, j.ip or '', json.dumps(j.details, ensure_ascii=False)])
        resp = HttpResponse(out.getvalue(), content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="journal_archives.csv"'
        return resp
    return render(request, T + '_journal.html', {'entrees': qs[:200], 'actions': ArchiveJournal.ACTIONS, 'action': request.GET.get('action', ''), 'q': request.GET.get('q', '')})


@login_required
@require_POST
def ar_inventorier(request):
    if not est_admin_archives(request.user):
        raise PermissionDenied
    deja = set(ArchiveFiche.objects.values_list('archive_id', flat=True))
    n = 0
    for a in _qs(request).exclude(pk__in=list(deja)).select_related(*_rel())[:200]:
        synchroniser_fiche(a)
        n += 1
    resp = _tableau(request)
    resp['HX-Trigger'] = json.dumps({'arMaj': {'message': '%d document%s inventorié%s.' % (n, 's' if n > 1 else '', 's' if n > 1 else ''), 'niveau': 'ok'}})
    return resp


@login_required
@require_POST
def ar_integrite_tout(request):
    if not est_admin_archives(request.user):
        raise PermissionDenied
    ids = list(_qs(request).values_list('pk', flat=True))
    fiches = ArchiveFiche.objects.filter(archive_id__in=ids, supprime_le__isnull=True).order_by('integrite_verifiee_le')[:300]
    archives = {a.pk: a for a in modele_archive().objects.filter(pk__in=[f.archive_id for f in fiches])}
    ok = ko = 0
    for f in fiches:
        if f.archive_id in archives:
            if _verifier(archives[f.archive_id], f, request)[0]:
                ok += 1
            else:
                ko += 1
    resp = _tableau(request)
    resp['HX-Trigger'] = json.dumps({'arMaj': {'message': '%d fichier%s contrôlé%s : %d intact%s, %d altéré%s ou manquant%s.' % (
        ok + ko, 's' if ok + ko > 1 else '', 's' if ok + ko > 1 else '', ok, 's' if ok > 1 else '', ko, 's' if ko > 1 else '', 's' if ko > 1 else ''),
        'niveau': 'erreur' if ko else 'ok'}})
    return resp
