# Application « vitrine » — site public OperaPlus

Votre views.py principal n'est PAS modifié : tout est dans cette application.

## Installation (5 minutes)
1. Copiez le dossier `vitrine/` à la racine du projet (à côté de manage.py).
2. settings.py :
       INSTALLED_APPS += ["vitrine"]
       VITRINE_BASE_TEMPLATE = "presentation.html"        # le nom de votre page d'accueil
       VITRINE_CONTACT_EMAIL = "contact@votre-domaine"     # où recevoir les demandes (sinon ADMINS)
       # facultatif :
       MEAL_AFRIQUE_RSS = "https://…/rss/"                # flux du journal -> 3 dernières actus sur l'accueil
       VITRINE_ENTREPRISE = {"raison_sociale": "…", "adresse": "…", "email": "…", "telephone": "…",
                             "directeur_publication": "…", "hebergeur": "…", "immatriculation": "…",
                             "conservation": "Les messages sont supprimés après 24 mois."}
       VITRINE_SECURITE = {"hebergement": "…", "sauvegardes": "…", "chiffrement": "…"}   # n'affichez que ce qui est vrai
       VITRINE_DERRIERE_PROXY = True   # seulement si le site est derrière Nginx/Cloudflare
3. urls.py (après vos routes) :
       path("", include("vitrine.urls")),
   et SUPPRIMEZ vos anciennes routes robots.txt / sitemap.xml si vous les aviez ajoutées.
4. python manage.py migrate vitrine
5. Supprimez l'ancien dossier `templatetags/opera_stats.py` si vous l'aviez copié :
   la balise est maintenant dans vitrine/templatetags/.
6. Remplacez votre presentation.html par accueil_operaplus.html (renommé).
7. Dans presentation.html, renseignez en haut du <body> les deux adresses :
       {% firstof meal_afrique_url "https://…" as MEAL_AFRIQUE %}
       {% firstof documentation_url "https://…" as DOC_URL %}

## Dans l'admin
- Partenaires : un logo ne s'affiche QUE si « accord d'affichage » est coché.
- Témoignages : visibles QUE si « publié » ET « accord de publication » sont cochés.
- Messages de contact : lecture seule, cochez « traité ».
- Membres MEAL Afrique : pour le badge dans l'application :
      {% load vitrine %}{% if request.user|est_membre_meal %}<span class="badge">Membre MEAL Afrique</span>{% endif %}

## Sécurité du formulaire de contact
- Protection CSRF de Django, envoi en POST uniquement.
- Champ piège invisible + jeton signé : envoi refusé s'il arrive en moins de 3 s ou après 6 h.
- 5 messages maximum par heure et par adresse IP.
- L'adresse IP n'est jamais enregistrée en clair (empreinte chiffrée).
- Longueurs limitées, aucun HTML interprété (échappement automatique).
- Un robot reçoit « message envoyé » sans que rien ne soit enregistré.
