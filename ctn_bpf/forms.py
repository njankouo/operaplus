from django import forms
from django.core import signing

from .models import MessageContact

DELAI_MIN = 3          # secondes : un humain met plus de 3 s à remplir le formulaire
DELAI_MAX = 60 * 60 * 6


def jeton_formulaire():
    """Jeton signé contenant l'heure d'affichage du formulaire (anti-robots)."""
    return signing.TimestampSigner(salt="vitrine-contact").sign("ok")


class ContactForm(forms.Form):
    """Validé côté serveur ; le HTML du formulaire reste écrit à la main dans le gabarit."""
    nom = forms.CharField(max_length=120)
    email = forms.EmailField(max_length=254)
    organisation = forms.CharField(max_length=160, required=False)
    besoin = forms.ChoiceField(choices=MessageContact.BESOINS)
    projets = forms.IntegerField(min_value=0, max_value=10000, required=False)
    utilisateurs = forms.IntegerField(min_value=0, max_value=100000, required=False)
    message = forms.CharField(max_length=3000, min_length=10)
    consentement = forms.BooleanField(required=True)
    site_web = forms.CharField(required=False)     # champ piège, invisible pour les humains
    jeton = forms.CharField()

    def clean_site_web(self):
        if self.cleaned_data.get("site_web"):
            raise forms.ValidationError("robot")
        return ""

    def clean_jeton(self):
        jeton = self.cleaned_data["jeton"]
        signer = signing.TimestampSigner(salt="vitrine-contact")
        try:
            signer.unsign(jeton, max_age=DELAI_MAX)
        except signing.SignatureExpired:
            raise forms.ValidationError("Le formulaire a expiré, rechargez la page.")
        except signing.BadSignature:
            raise forms.ValidationError("robot")
        try:                                   # encore valide après 3 s ? -> envoyé trop vite
            signer.unsign(jeton, max_age=DELAI_MIN)
        except signing.SignatureExpired:
            return jeton
        raise forms.ValidationError("trop rapide")
