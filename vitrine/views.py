"""Vues du site vitrine. Ce fichier est propre à l'application « vitrine » :
votre views.py principal n'est pas modifié."""
import hashlib
import logging

from django.conf import settings
from django.contrib import messages
from django.core.cache import cache
from django.core.mail import mail_admins, send_mail
from django.http import Http404
from django.shortcuts import redirect, render
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET, require_POST

from .data import FONCTIONNALITES, PAR_SLUG
from .forms import ContactForm
from .models import MessageContact

log = logging.getLogger(__name__)
LIMITE_MESSAGES = getattr(settings, "VITRINE_LIMITE_MESSAGES", 5)   # par heure et par adresse IP


def _base():
    return getattr(settings, "VITRINE_BASE_TEMPLATE", "presentation.html")


def _ip_hachee(request):
    ip = request.META.get("REMOTE_ADDR", "")
    if getattr(settings, "VITRINE_DERRIERE_PROXY", False):
        ip = request.META.get("HTTP_X_FORWARDED_FOR", ip).split(",")[0].strip()
    return hashlib.sha256((settings.SECRET_KEY + ip).encode()).hexdigest()


@require_GET
def fonctionnalite(request, slug):
    f = PAR_SLUG.get(slug)
    if f is None:
        raise Http404()
    autres = [x for x in FONCTIONNALITES if x["slug"] != slug]
    return render(request, "vitrine/fonctionnalite.html", {"f": f, "autres": autres, "vitrine_base": _base()})


PAGES = {
    "securite": ("vitrine/securite.html", "Sécurité des données"),
    "mentions-legales": ("vitrine/mentions_legales.html", "Mentions légales"),
    "confidentialite": ("vitrine/confidentialite.html", "Politique de confidentialité"),
}


@require_GET
def page(request, slug):
    if slug not in PAGES:
        raise Http404()
    gabarit, titre = PAGES[slug]
    return render(request, gabarit, {"titre": titre, "vitrine_base": _base(),
                                     "entreprise": getattr(settings, "VITRINE_ENTREPRISE", {}),
                                     "securite": getattr(settings, "VITRINE_SECURITE", {})})


@require_GET
def accueil_en(request):
    return render(request, "vitrine/en.html", {"vitrine_base": _base(), "fonctionnalites": FONCTIONNALITES})


@require_POST
def contact(request):
    retour = "/#contact"
    cle = "vitrine_contact_" + _ip_hachee(request)[:32]
    envois = cache.get(cle, 0)
    if envois >= LIMITE_MESSAGES:
        messages.error(request, "Vous avez déjà envoyé plusieurs messages. Réessayez dans une heure.")
        return redirect(retour)

    form = ContactForm(request.POST)
    if not form.is_valid():
        erreurs = form.errors.as_data()
        if "site_web" in erreurs or ("jeton" in erreurs and "robot" in str(erreurs["jeton"])):
            # robot détecté : on ne lui donne aucune indication
            messages.success(request, "Merci, votre message a bien été envoyé.")
            return redirect(retour)
        messages.error(request, "Merci de vérifier les champs : nom, e-mail, message (10 caractères minimum) et consentement.")
        return redirect(retour)

    d = form.cleaned_data
    msg = MessageContact.objects.create(
        nom=d["nom"], email=d["email"], organisation=d.get("organisation", ""), besoin=d["besoin"],
        projets=d.get("projets"), utilisateurs=d.get("utilisateurs"), message=d["message"],
        consentement=True, ip_hachee=_ip_hachee(request))
    cache.set(cle, envois + 1, 60 * 60)

    destinataire = getattr(settings, "VITRINE_CONTACT_EMAIL", None)
    corps = f"{msg}\n\nOrganisation : {msg.organisation}\nProjets : {msg.projets}\nUtilisateurs : {msg.utilisateurs}\n\n{msg.message}"
    try:
        if destinataire:
            send_mail(f"[OperaPlus] {msg.get_besoin_display()} — {msg.nom}", corps, None, [destinataire], fail_silently=True)
        else:
            mail_admins(f"[OperaPlus] {msg.get_besoin_display()} — {msg.nom}", corps, fail_silently=True)
    except Exception:
        log.exception("vitrine : envoi de l'e-mail impossible")

    messages.success(request, "Merci, votre message a bien été envoyé. Nous vous répondons sous 48 h ouvrées.")
    return redirect(retour)


@require_GET
@cache_page(60 * 60 * 24)
def robots_txt(request):
    return render(request, "vitrine/robots.txt", content_type="text/plain; charset=utf-8")


@require_GET
@cache_page(60 * 60 * 6)
def sitemap_xml(request):
    return render(request, "vitrine/sitemap.xml", {"fonctionnalites": FONCTIONNALITES, "pages": PAGES},
                  content_type="application/xml; charset=utf-8")
