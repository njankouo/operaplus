import datetime
from django.shortcuts import redirect
from django.core.exceptions import ObjectDoesNotExist

# Importez vos modèles ici (ajustez selon votre structure de dossiers)
# from .models import Aggregate 
import datetime
from django.shortcuts import redirect
from django.core.exceptions import ObjectDoesNotExist
def basis(request):
    # Initialisation de TOUTES les clés possibles pour éviter KeyError
    context = {
        'actual_institution': None,
        'permissions': 10,
        'animate': None,
        'animate2': None,
        'prenom': "",
        'nom': "",
        'role': None,
        'picture': None,
        'entity_manage': None,
        'programmes': [],
        'nb_programmes': 0,
        'get_entities': [],
        'get_entities2': [],
        'this_period': datetime.datetime.now(),
    }
    
    user = request.user

    # 1. Sécurité Authentification
    if not user.is_authenticated:
        return redirect('login') 

    # 2. Gestion des sessions
    if request.session.get('logged') == 1:
        request.session['logged'] = 0
        context['animate'] = 0

    # 3. Récupération Personnel et Institution
    try:
        personnel = user.personnel
        actual_institution = personnel.actual_institution
        
        if not actual_institution:
            return redirect('/no_institution/') # REDIRECTION SI VIDE
            
    except (ObjectDoesNotExist, AttributeError):
        return redirect('/page_erreur_profil/')

    # 4. Remplissage des données (Maintenant qu'on est sûr que l'institution existe)
    try:
        role = personnel.get_function(actual_institution.id)
        
        # Logique des permissions
        permissions = 10
        entity_manage = None
        if actual_institution.owner and actual_institution.owner.m_user == user:
            permissions = 100
        elif role:
            permissions = role.m_role.permissions
            if role.m_role.m_nature == "1":
                eRACI = personnel.RACI_manage()
                if eRACI and eRACI[0]:
                    entity_manage = eRACI[0]
            elif permissions < 0:
                entity_manage = role.m_entity

        # Mise à jour massive du contexte
        context.update({
            'actual_institution': actual_institution,
            'prenom': personnel.prenom,
            'nom': personnel.nom,
            'role': role,
            'picture': personnel.photo,
            'permissions': permissions,
            'entity_manage': entity_manage,
            'default_struc_name': actual_institution.default_struc_name,
            'operations_name': actual_institution.operations_name,
            'insti_structures': actual_institution.structures(),
            'default_period': actual_institution.default_period,
            'get_entities': actual_institution.get_entities(),
            'top_entity': actual_institution.top_entity(),
            'last_entity': actual_institution.last_entity(),
        })

        if context['get_entities']:
            context['get_entities2'] = list(context['get_entities'])[:-1]

        # Calcul de la semaine
        now = context['this_period']
        tmp_week = int(max(1, now.day / 7))
        if now.day > now.isoweekday() * tmp_week:
            tmp_week += 1
        context['this_week'] = tmp_week

    except Exception as e:
        print(f"Erreur lors du calcul contextuel : {e}")
        

    return context