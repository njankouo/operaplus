from .models import *
from rest_framework.serializers import ModelSerializer

class OperationSerializer(ModelSerializer):
    class Meta:
        fields = ['id','nom','personnel','accountable','consulted','informed','date_debut','date_echeance',]
        model = Operation

class PersonnelSerializer(ModelSerializer):
    class Meta:
        fields=['id','nom','prenom','mail','photo']
        model = Personnel

class HistoricRaciSerializer(ModelSerializer):
    class Meta:
        model = HistoricRACI
        fields =['id','m_operation']
class IndicateurValeurSerializer(ModelSerializer):
    class Meta:
        fields =['id','operation','date_enregistrement']
        model = IndicateurValeur

class InstitutionSerializer(ModelSerializer):
    class Meta:
        fields =['id','nom','sigle']
        model = Institution


from django.contrib.auth import authenticate
from django.db.models import Q
from .models import Personnel
import logging

logger = logging.getLogger(__name__)

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from rest_framework import exceptions
from .models import Personnel
class PersonnelEmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Récupération et nettoyage des credentials
        email = attrs.get('username', '').strip()
        password = attrs.get('password', '').strip()

        if not email or not password:
            raise exceptions.AuthenticationFailed(
                'Email et mot de passe requis',
                'missing_credentials',
            )

        logger.debug(f"Tentative de connexion avec email: '{email}'")

        # Recherche du personnel (insensible à la casse + gestion des espaces)
        try:
            personnel = Personnel.objects.filter(
                Q(mail__iexact=email) |
                Q(mail__iexact=email.strip())
            ).select_related('bd_user').first()

            if not personnel:
                existing_emails = list(Personnel.objects.values_list('mail', flat=True))
                logger.warning(f"Email non trouvé. Emails existants: {existing_emails}")
                raise exceptions.AuthenticationFailed(
                    'Identifiants invalides',
                    'invalid_credentials',
                )

            # Vérification exacte de l'email (après la recherche insensible à la casse)
            if personnel.mail != email:
                logger.warning(
                    f"Correspondance insensible à la casse trouvée mais pas exacte: '{personnel.mail}' != '{email}'")

            # Authentification
            authenticate_kwargs = {
                'username': personnel.bd_user.username,
                'password': password,
            }

            if hasattr(self, 'context') and 'request' in self.context:
                authenticate_kwargs['request'] = self.context['request']

            self.user = authenticate(**authenticate_kwargs)

            if not self.user:
                logger.warning("Authentification échouée (mauvais mot de passe)")
                raise exceptions.AuthenticationFailed(
                    'Identifiants invalides',
                    'invalid_credentials',
                )

            if not self.user.is_active:
                logger.warning("Tentative de connexion d'un compte inactif")
                raise exceptions.AuthenticationFailed(
                    'Compte désactivé',
                    'account_disabled',
                )

            # Génération du token
            refresh = self.get_token(self.user)

            # Réponse avec les données utilisateur
            return {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': self.user.id,
                    'email': personnel.mail,
                    'username': self.user.username,
                    'is_active': self.user.is_active,
                    # Ajoutez d'autres champs si nécessaire
                }
            }

        except Exception as e:
            logger.error(f"Erreur d'authentification: {str(e)}", exc_info=True)
            raise exceptions.AuthenticationFailed(
                'Une erreur est survenue lors de l\'authentification',
                'authentication_error',
            )
