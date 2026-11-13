"""
Archivage numérique OPERAPLUS — outils communs.

Application indépendante « archive » : elle ne modifie pas votre modèle d'archive existant,
elle le retrouve tout seul (ou via settings.ARCHIVAGE_MODELE = 'app.Modele') et lui ajoute
une « fiche » (cote, intégrité, cycle de vie, confidentialité...).
"""
import contextvars
import hashlib
import mimetypes
import os
import re
import unicodedata
from datetime import date, timedelta

from django.apps import apps
from django.conf import settings
from django.db import models

# ---------------------------------------------------------------- requête courante
_requete = contextvars.ContextVar('archivage_requete', default=None)


class RequeteCouranteMiddleware:
    """À ajouter dans MIDDLEWARE : permet au signal de savoir QUI dépose un document
    et de lire les champs « ap_* » du formulaire existant /add_archive/."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        jeton = _requete.set(request)
        try:
            return self.get_response(request)
        finally:
            _requete.reset(jeton)


def requete_courante():
    return _requete.get()


# ---------------------------------------------------------------- modèles existants
_cache = {}


def modele_archive():
    if 'archive' in _cache:
        return _cache['archive']
    nom = getattr(settings, 'ARCHIVAGE_MODELE', None)
    trouve = None
    if nom:
        trouve = apps.get_model(nom)
    else:
        for m in apps.get_models():
            if m._meta.app_label == 'archive':
                continue
            noms = {f.name for f in m._meta.get_fields()}
            if {'titre', 'provenance', 'source_financement'} <= noms and any(isinstance(f, models.FileField) for f in m._meta.fields):
                trouve = m
                break
    if trouve is None:
        raise LookupError("Archivage : modèle d'archive introuvable. Ajoutez ARCHIVAGE_MODELE = 'app.NomDuModele' dans settings.py")
    _cache['archive'] = trouve
    return trouve


def champ_fichier():
    if 'fichier' not in _cache:
        _cache['fichier'] = next(f for f in modele_archive()._meta.fields if isinstance(f, models.FileField))
    return _cache['fichier']


def champ_sous_cat():
    """Clé étrangère archive -> sous-catégorie (celle dont le related_name est 'archives')."""
    if 'sous_cat' not in _cache:
        fks = [f for f in modele_archive()._meta.fields if f.is_relation and f.many_to_one]
        choix = [f for f in fks if f.remote_field.related_name == 'archives'] or [f for f in fks if 'sous' in f.name.lower()]
        _cache['sous_cat'] = choix[0] if choix else None
    return _cache['sous_cat']


def modele_sous_cat():
    c = champ_sous_cat()
    return c.related_model if c else None


def champ_sous_cat_vers_cat():
    if 'sc_cat' not in _cache:
        sc = modele_sous_cat()
        fk = None
        if sc is not None:
            fks = [f for f in sc._meta.fields if f.is_relation and f.many_to_one]
            choix = [f for f in fks if f.remote_field.related_name == 'sous_categories'] or [f for f in fks if 'cat' in f.name.lower()]
            fk = choix[0] if choix else None
        _cache['sc_cat'] = fk
    return _cache['sc_cat']


def modele_cat():
    c = champ_sous_cat_vers_cat()
    return c.related_model if c else None


def champ_cat():
    """Clé étrangère directe archive -> catégorie, si votre modèle en a une."""
    if 'cat' not in _cache:
        mc = modele_cat()
        _cache['cat'] = next((f for f in modele_archive()._meta.fields
                              if f.is_relation and f.many_to_one and mc is not None and f.related_model is mc), None)
    return _cache['cat']


def champ_date_ajout():
    if 'date' not in _cache:
        fs = [f for f in modele_archive()._meta.fields if isinstance(f, (models.DateTimeField, models.DateField))]
        auto = [f for f in fs if getattr(f, 'auto_now_add', False)]
        _cache['date'] = (auto or fs or [None])[0]
    return _cache['date']


def champs_texte_archive():
    noms = {f.name for f in modele_archive()._meta.concrete_fields if isinstance(f, (models.CharField, models.TextField))}
    return [n for n in ('titre', 'description', 'auteur', 'provenance', 'source_financement') if n in noms]


# ---------------------------------------------------------------- institution
def institution_de(user):
    perso = getattr(user, 'personnel', None)
    return getattr(perso, 'actual_institution', None) if perso is not None else None


def filtrer_institution(qs, request):
    """Limite les archives à l'institution active de l'utilisateur, si le schéma le permet."""
    inst = institution_de(request.user)
    if inst is None or request.user.is_superuser and getattr(settings, 'ARCHIVAGE_SUPERUSER_TOUT', False):
        return qs
    A = modele_archive()
    noms = {f.name for f in A._meta.fields}
    if 'institution' in noms:
        return qs.filter(institution=inst)
    sc, scc = champ_sous_cat(), champ_sous_cat_vers_cat()
    if sc is not None:
        if 'institution' in {f.name for f in sc.related_model._meta.fields}:
            return qs.filter(**{sc.name + '__institution': inst})
        if scc is not None and 'institution' in {f.name for f in scc.related_model._meta.fields}:
            return qs.filter(**{sc.name + '__' + scc.name + '__institution': inst})
    return qs


# ---------------------------------------------------------------- fichiers
def sha256_de(fieldfile):
    h = hashlib.sha256()
    taille = 0
    fieldfile.open('rb')
    try:
        for bloc in fieldfile.chunks(1024 * 1024):
            h.update(bloc)
            taille += len(bloc)
    finally:
        fieldfile.close()
    return h.hexdigest(), taille


def type_mime(nom):
    return mimetypes.guess_type(nom or '')[0] or 'application/octet-stream'


def famille(nom):
    ext = os.path.splitext(nom or '')[1].lower().lstrip('.')
    if ext == 'pdf':
        return 'pdf'
    if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff'):
        return 'image'
    if ext in ('doc', 'docx', 'odt', 'rtf', 'txt'):
        return 'texte'
    if ext in ('xls', 'xlsx', 'ods', 'csv'):
        return 'tableur'
    return 'autre'


def extraire_texte(fieldfile):
    """Texte recherchable : PDF via pypdf, image via pytesseract (si installés). Sinon vide."""
    nom = fieldfile.name or ''
    fam = famille(nom)
    texte = ''
    try:
        if fam == 'pdf':
            from pypdf import PdfReader
            fieldfile.open('rb')
            try:
                lecteur = PdfReader(fieldfile)
                texte = '\n'.join((p.extract_text() or '') for p in lecteur.pages[:60])
            finally:
                fieldfile.close()
        elif fam == 'image' and getattr(settings, 'ARCHIVAGE_OCR', True):
            import pytesseract
            from PIL import Image
            fieldfile.open('rb')
            try:
                texte = pytesseract.image_to_string(Image.open(fieldfile), lang=getattr(settings, 'ARCHIVAGE_OCR_LANGUE', 'fra'))
            finally:
                fieldfile.close()
    except Exception:
        texte = ''
    return re.sub(r'\s+', ' ', texte).strip()[:200000]


def taille_lisible(n):
    n = n or 0
    for u in ('o', 'Ko', 'Mo', 'Go'):
        if n < 1024 or u == 'Go':
            return ('%d %s' % (n, u)) if u in ('o', 'Ko') else ('%.1f %s' % (n, u)).replace('.', ',')
        n /= 1024.0


def sans_accent(s):
    return unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode()


def ajouter_annees(d, n):
    try:
        return d.replace(year=d.year + n)
    except ValueError:  # 29 février
        return d.replace(year=d.year + n, day=28)


# ---------------------------------------------------------------- droits
def est_admin_archives(user):
    return bool(user.is_authenticated and (user.is_superuser or user.is_staff or user.has_perm('archive.administrer_archives')))


def peut_voir(user, fiche):
    if est_admin_archives(user):
        return True
    if fiche is None or fiche.confidentialite in ('public', 'interne'):
        return True
    if fiche.confidentialite == 'confidentiel' and fiche.depose_par_id == user.id:
        return True
    return fiche.acces.filter(pk=user.pk).exists()


def peut_modifier(user, fiche):
    return est_admin_archives(user) or (fiche is not None and fiche.depose_par_id == user.id)


# ---------------------------------------------------------------- journal
def ip_de(request):
    if request is None:
        return None
    fw = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return (fw.split(',')[0].strip() or request.META.get('REMOTE_ADDR') or None) if fw else request.META.get('REMOTE_ADDR')


def journaliser(action, archive_id=None, fiche=None, titre='', request=None, details=None, user=None):
    from .models import ArchiveJournal
    request = request or requete_courante()
    if user is None and request is not None and getattr(request, 'user', None) is not None and request.user.is_authenticated:
        user = request.user
    ArchiveJournal.objects.create(
        archive_id=archive_id or (fiche.archive_id if fiche else None),
        titre=(titre or '')[:255],
        cote=(fiche.cote if fiche else '') or '',
        action=action,
        utilisateur=user,
        nom_utilisateur=(str(getattr(user, 'personnel', '') or '') or (user.get_full_name() if user else '') or (user.username if user else 'système'))[:150],
        ip=ip_de(request),
        details=details or {},
    )


# ---------------------------------------------------------------- fiche
def code_dossier(archive):
    cat = None
    cf = champ_cat()
    if cf is not None:
        cat = getattr(archive, cf.name, None)
    if cat is None:
        sc = champ_sous_cat()
        scc = champ_sous_cat_vers_cat()
        sous = getattr(archive, sc.name, None) if sc else None
        cat = getattr(sous, scc.name, None) if (sous is not None and scc is not None) else None
    code = (getattr(cat, 'code', '') or '').strip() if cat is not None else ''
    if not code and cat is not None:
        code = re.sub(r'[^A-Z]', '', sans_accent(getattr(cat, 'nom', '')).upper())[:3]
    return re.sub(r'[^A-Z0-9]', '', sans_accent(code).upper())[:10] or 'ARC'


def generer_cote(archive):
    from .models import ArchiveFiche
    prefixe = '%s-%d-' % (code_dossier(archive), date.today().year)
    n = ArchiveFiche.objects.filter(cote__startswith=prefixe).count() + 1
    while ArchiveFiche.objects.filter(cote=prefixe + '%05d' % n).exists():
        n += 1
    return prefixe + '%05d' % n


EXTRAS = ('type_document', 'date_document', 'lieu', 'langue', 'mots_cles', 'confidentialite')


def appliquer_extras(fiche, donnees, prefixe='ap_'):
    from django.utils.dateparse import parse_date
    for c in EXTRAS:
        v = donnees.get(prefixe + c)
        if v is None:
            continue
        v = v.strip()
        if c == 'date_document':
            fiche.date_document = parse_date(v) if v else None
        elif c == 'confidentialite':
            if v in dict(fiche.CONFIDENTIALITE):
                fiche.confidentialite = v
        elif c == 'mots_cles':
            fiche.mots_cles = ', '.join(dict.fromkeys(m.strip() for m in v.split(',') if m.strip()))[:400]
        else:
            setattr(fiche, c, v[:fiche._meta.get_field(c).max_length])


def synchroniser_fiche(archive, creation=False):
    """Crée/met à jour la fiche d'une archive : cote, empreinte SHA-256, texte, dossier."""
    from .models import ArchiveFiche
    fiche, nouvelle = ArchiveFiche.objects.get_or_create(archive_id=archive.pk)
    req = requete_courante()
    f = getattr(archive, champ_fichier().name)
    sc = champ_sous_cat()
    maj = []
    if nouvelle:
        if req is not None and getattr(req, 'user', None) is not None and req.user.is_authenticated:
            fiche.depose_par = req.user
        if req is not None and req.method == 'POST':
            appliquer_extras(fiche, req.POST)
        fiche.cote = generer_cote(archive)
    sc_id = getattr(archive, sc.attname, None) if sc else None
    if fiche.sous_categorie_id != sc_id:
        fiche.sous_categorie_id = sc_id
    nom = f.name if f else ''
    if nom and nom != fiche.fichier_nom:
        try:
            fiche.sha256, fiche.taille = sha256_de(f)
            fiche.integrite_ok, fiche.integrite_verifiee_le = True, None
        except Exception:
            fiche.sha256, fiche.taille, fiche.integrite_ok = '', 0, False
        fiche.type_mime = type_mime(nom)
        fiche.texte_extrait = extraire_texte(f)
        maj.append('fichier')
        fiche.fichier_nom = nom
    fiche.save()
    if not getattr(archive, '_ar_silencieux', False):
        if nouvelle:
            journaliser('creation' if creation else 'inventaire', fiche=fiche, titre=getattr(archive, 'titre', ''),
                        details={'sha256': fiche.sha256, 'taille': fiche.taille})
        elif maj:
            journaliser('modification', fiche=fiche, titre=getattr(archive, 'titre', ''), details={'champs': ['fichier'], 'sha256': fiche.sha256})
    return fiche


def fiche_de(archive):
    from .models import ArchiveFiche
    f = ArchiveFiche.objects.filter(archive_id=archive.pk).first()
    return f or synchroniser_fiche(archive)


def charger_regles(fiches):
    from .models import RegleConservation
    ids = {f.sous_categorie_id for f in fiches if f.sous_categorie_id}
    regles = {r.sous_categorie_id: r for r in RegleConservation.objects.filter(sous_categorie_id__in=ids)}
    for f in fiches:
        f._regle = regles.get(f.sous_categorie_id)
    return fiches


# ---------------------------------------------------------------- présentation
class Doc:
    """Vue simple d'une archive + sa fiche pour les gabarits."""

    def __init__(self, archive, fiche):
        self.a, self.fiche, self.id = archive, fiche, archive.pk
        self.titre = getattr(archive, 'titre', '') or 'Sans titre'
        for n in ('auteur', 'description', 'provenance', 'source_financement'):
            setattr(self, n, getattr(archive, n, '') or '')
        self.fichier = getattr(archive, champ_fichier().name)
        self.nom_fichier = os.path.basename(self.fichier.name) if self.fichier else ''
        self.famille = famille(self.nom_fichier)
        self.ext = (os.path.splitext(self.nom_fichier)[1].lstrip('.') or '?')[:4].upper()
        cd = champ_date_ajout()
        self.date_ajout = getattr(archive, cd.name, None) if cd else None
        if self.date_ajout is None and fiche is not None:
            self.date_ajout = fiche.cree_le
        sc, scc = champ_sous_cat(), champ_sous_cat_vers_cat()
        self.sous_cat = getattr(archive, sc.name, None) if sc else None
        self.cat = getattr(self.sous_cat, scc.name, None) if (self.sous_cat is not None and scc) else None
        self.taille_h = taille_lisible(fiche.taille if fiche else 0)
        self.phase = fiche.phase() if fiche else ('actif', 'Actif')


def presenter(archives, request=None):
    """Liste de Doc visibles (hors corbeille) avec fiches et règles chargées en lot."""
    from .models import ArchiveFiche
    archives = list(archives)
    fiches = {f.archive_id: f for f in ArchiveFiche.objects.filter(archive_id__in=[a.pk for a in archives])}
    for a in archives:
        if a.pk not in fiches:
            fiches[a.pk] = synchroniser_fiche(a)
    charger_regles(list(fiches.values()))
    docs = []
    for a in archives:
        fi = fiches[a.pk]
        if request is not None and not peut_voir(request.user, fi):
            continue
        docs.append(Doc(a, fi))
    return docs


def avant(jours):
    return date.today() + timedelta(days=jours)
