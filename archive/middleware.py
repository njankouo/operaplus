"""À ajouter à la fin de MIDDLEWARE :  'archive.middleware.RequeteCouranteMiddleware'
Permet de savoir QUI dépose un document et de lire les champs « ap_* » du formulaire existant."""
from .utils import RequeteCouranteMiddleware  # noqa: F401
