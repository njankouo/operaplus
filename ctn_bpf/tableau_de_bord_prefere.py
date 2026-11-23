# =====================================================================
#  OperaPlus — Tableau de bord préféré (v93)
#  Quand le personnel a activé le tableau de bord TECHNIQUE (Personnel.is_technic = True),
#  chaque retour à l'accueil (et l'arrivée après connexion) l'envoie sur /dashboard-technics/.
#
#  Installation (settings.py) — APRÈS AuthenticationMiddleware (et après SansInstitutionMiddleware s'il est là) :
#      MIDDLEWARE = [
#          ...
#          'django.contrib.auth.middleware.AuthenticationMiddleware',
#          ...
#          'votre_app.tableau_de_bord_prefere.TableauDeBordPrefereMiddleware',
#      ]
#  (copiez ce fichier dans le dossier de votre application, à côté de views.py)
#
#  Réglages facultatifs (settings.py) :
#      OPERAPLUS_ACCUEILS = ('/',)          # adresse(s) de votre page d'accueil
#  Pour voir l'accueil SANS être redirigé : /?accueil=1  (lien « Accueil » du tableau de bord technique)
#  Pour ne plus être redirigé : choisir « Processus » ou « Financier » dans le sélecteur du tableau de bord.
# =====================================================================

from django.conf import settings
from django.shortcuts import redirect

# choix enregistré sur le personnel → page du tableau de bord
# (ajoutez ici 'is_finance': '/dashboard-finance/' le jour où le tableau de bord financier existe)
PAGES_PREFEREES = (
    ('is_technic', '/dashboard-technics/'),
)


class TableauDeBordPrefereMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.accueils = tuple(getattr(settings, 'OPERAPLUS_ACCUEILS', ('/',)))

    def __call__(self, request):
        if request.method == 'GET' and request.path in self.accueils and 'accueil' not in request.GET:
            user = getattr(request, 'user', None)
            if user is not None and user.is_authenticated:
                personnel = getattr(user, 'personnel', None)          # pas de personnel : on ne fait rien
                if personnel is not None and personnel.actual_institution_id:
                    for champ, page in PAGES_PREFEREES:
                        if getattr(personnel, champ, False) and request.path != page:
                            return redirect(page)
        return self.get_response(request)
