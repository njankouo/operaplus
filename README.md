# OperaPlus — Plateforme MEAL de suivi-évaluation

OperaPlus est une application web Django qui couvre tout le cycle **MEAL** (*Monitoring, Evaluation, Accountability & Learning*) des ONG, des projets de développement et des institutions publiques. Elle réunit dans un seul outil :

- la **planification** : cadre logique, activités, échéances, rôles RACI ;
- la **collecte** des données terrain ;
- le **calcul des indicateurs** ;
- les **tableaux de bord** ;
- la **redevabilité** envers les bénéficiaires et les bailleurs.

> Domaine de production : `iacs.operaplus.org` · Projet Django : `Opera_CTN` · Application principale : `ctn_bpf`

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Prérequis](#prérequis)
4. [Installation](#installation)
5. [Configuration (.env)](#configuration-env)
6. [Lancer l'application](#lancer-lapplication)
7. [Tâches planifiées](#tâches-planifiées)
8. [Site vitrine et référencement](#site-vitrine-et-référencement)
9. [Personnalisation de l'interface](#personnalisation-de-linterface)
10. [Sécurité](#sécurité)
11. [Mise en production](#mise-en-production)
12. [Conventions de développement](#conventions-de-développement)
13. [Dépannage](#dépannage)

---

## Fonctionnalités

| Module | Accès | Rôle |
|---|---|---|
| **Tableau de bord** | `/` | Vues physique, technique et financière ; baromètres déclaré / validé ; notifications RACI |
| **Logique** | `/configurations/` | Cadre logique : impact, résultats, produits, activités |
| **Indicateurs** | `/evaluer/0/` | Indicateurs, cibles par période et par unité, calcul (`/api/indicators/calculate/`) |
| **Planification** | `/gestionnaire/0/0/` | Activités, échéances, pondérations, vue Gantt, rôles RACI |
| **Collecte** | `/forms/` | Formulaires de collecte, saisie (`/grub_form/<id>/`), import Excel / CSV contrôlé |
| **Opérations** | `/operations/<id>` | Rapport de réalisation budgétaire et technique, pièces jointes, transactions |
| **Structures** | `/structures/` | Unités organisationnelles |
| **RH** | `/personnels/` | Équipes, rôles et droits |
| **Archives** | `/archive_doc/` | Documents, rapports et leçons apprises |
| **Système** | `/configurations_admin/` | Paramètres, périodes, référentiels, notifications |
| **Avancé** | `/planification/`, `/priorisation/` | Microplanification, priorisation (urgence et impact) |
| **Multi-projets** | `/set_institution/<id>/` | Plusieurs projets et institutions rattachées, chacun avec ses couleurs |

**Fonctions transverses**
- **Alertes de retard** : la carte d'alerte s'appuie sur `/count_operation_retard/` et `/count_transaction/`.
- **Import intelligent** : contrôle en trois étapes (`/check-periods/`, `/check-elements/`, `/check-orgunits/`), rapport d'anomalies, puis import (`/final-import-data/`).
- **Connexion** par e-mail, Google ou Microsoft (django-allauth).
- **Application installable** sur téléphone (PWA).
- **Interface multilingue** : français, anglais, espagnol.
- **API REST** avec authentification JWT.

---

## Architecture

```
iacs-opera/
├── manage.py
├── Opera_CTN/                 # configuration du projet (settings.py, urls.py, wsgi.py)
├── ctn_bpf/                   # application métier principale (modèles, vues, tâches Celery)
├── vitrine/                   # site public : pages fonctionnalités, contact, SEO (voir vitrine/README.md)
├── webpages/templates/webpages/ctn_bpf/   # gabarits (TEMPLATES["DIRS"])
├── locale/                    # traductions (.po / .mo)
├── static/                    # fichiers statiques collectés (STATIC_ROOT)
└── media/                     # fichiers envoyés par les utilisateurs (MEDIA_ROOT)
```

**Technologies**

| Domaine | Outils |
|---|---|
| Serveur | Django, Django REST Framework, Simple JWT |
| Base de données | PostgreSQL |
| Tâches de fond | Celery, Celery Beat (planificateur en base), Redis, django-crontab |
| Authentification | django-allauth (e-mail, Google, Microsoft), django-recaptcha |
| Divers Django | django-filter, django-cors-headers, django-countries, django-extensions, django-pwa, debug-toolbar |
| Interface | Tailwind CSS, Font Awesome, ApexCharts, amCharts, Highcharts / ECharts, d3, SweetAlert2 |
| IA (optionnel) | clés `GROQ_API_KEY` et `OPENAI_API_KEY` |

---

## Prérequis

- Python 3.10 ou plus récent
- PostgreSQL 13 ou plus récent
- Redis, pour Celery
- Node.js, uniquement pour compiler Tailwind en production (facultatif)

---

## Installation

```bash
# 1. Récupérer le code
git clone <url-du-depot> iacs-opera
cd iacs-opera

# 2. Environnement virtuel
python -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate

# 3. Dépendances
pip install -r requirements.txt
```

S'il n'existe pas encore de `requirements.txt`, installez les paquets utilisés par `settings.py`, puis figez-les avec `pip freeze > requirements.txt` :

```bash
pip install django djangorestframework djangorestframework-simplejwt django-allauth \
            django-filter django-cors-headers django-countries django-extensions \
            django-debug-toolbar django-crontab django-celery-beat django-recaptcha \
            django-pwa celery redis psycopg2-binary python-dotenv Pillow
```

```bash
# 4. Base de données
createdb operaplus                   # ou via pgAdmin
python manage.py migrate

# 5. Compte administrateur
python manage.py createsuperuser

# 6. Fichiers statiques
python manage.py collectstatic
```

---

## Configuration (.env)

Les réglages sensibles sont lus depuis un fichier `.env` à la racine, chargé par `python-dotenv`. **Ce fichier ne doit jamais être versionné** : ajoutez `.env` à `.gitignore`.

```dotenv
# Django
SECRET_KEY=une-cle-longue-et-aleatoire
DEBUG=False

# Base de données
DB_NAME=operaplus
DB_USER=operaplus
DB_PASSWORD=mot-de-passe-solide
DB_HOST=127.0.0.1
DB_PORT=5432

# E-mail (mot de passe d'application Gmail)
EMAIL_HOST_PASSWORD=xxxxxxxxxxxxxxxx

# reCAPTCHA
RECAPTCHA_PUBLIC_KEY=
RECAPTCHA_PRIVATE_KEY=

# IA (facultatif)
GROQ_API_KEY=
OPENAI_API_KEY=
```

Dans `settings.py`, lisez ces valeurs avec `os.getenv(...)`, par exemple :

```python
SECRET_KEY = os.getenv("SECRET_KEY")
DEBUG = os.getenv("DEBUG", "False") == "True"
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
```

Réglages propres à OperaPlus :

| Réglage | Rôle |
|---|---|
| `PERSONNAL_OPERA` / `PERSONNAL_INSTITUTION` | Mode « instance dédiée » et nom de l'institution affichée |
| `TIME_ZONE = "Africa/Douala"` | Fuseau horaire de l'application et de Celery |
| `LOGIN_REDIRECT_URL` | Page affichée après connexion (`/no_institution/` tant qu'aucune institution n'est liée) |
| `VITRINE_*`, `MEAL_AFRIQUE_RSS` | Réglages du site vitrine (voir `vitrine/README.md`) |

---

## Lancer l'application

```bash
# Serveur web (développement)
python manage.py runserver

# Redis (si non lancé comme service)
redis-server

# Worker Celery
celery -A Opera_CTN worker -l info

# Planificateur Celery Beat
celery -A Opera_CTN beat -l info
```

L'application est alors disponible sur <http://localhost:8000> et l'administration sur <http://localhost:8000/admin/>.

---

## Tâches planifiées

| Tâche | Fréquence | Outil |
|---|---|---|
| Sauvegarde des modèles et des données (`ctn_bpf.tasks.backup_models_and_data`) | tous les jours à 3 h | Celery Beat |
| Automatisations quotidiennes (`automatisation`) | tous les jours à 8 h | django-crontab |

```bash
python manage.py crontab add      # installer les tâches django-crontab
python manage.py crontab show     # vérifier
```

> `CELERY_BEAT_SCHEDULE` est défini deux fois dans `settings.py` : seule la seconde définition est prise en compte (`ctn_bpf.tasks…`). Supprimez la première pour éviter toute confusion.

---

## Site vitrine et référencement

L'application `vitrine` gère le site public sans modifier les vues métier :

- **Page d'accueil** (`presentation.html`) : chiffres réels mis en cache, profils, cycle MEAL, démo, contact, communauté MEAL Afrique.
- **Pages publiques** :
  - 9 pages « fonctionnalité » (`/fonctionnalites/<slug>/`) ;
  - `/securite/`, `/mentions-legales/`, `/confidentialite/` ;
  - la version anglaise `/en/`.
- **Référencement** : titres et descriptions propres à chaque page, données structurées, `robots.txt`, `sitemap.xml`, aperçu de partage (`static/og-operaplus.png`).
- **Formulaire de contact protégé** : CSRF, champ piège, jeton de délai, 5 envois par heure et par adresse IP, IP jamais conservée en clair.
- **Contenus gérés dans l'admin** : partenaires, témoignages, messages reçus, membres MEAL Afrique.

Installation et réglages : **`vitrine/README.md`**.

---

## Personnalisation de l'interface

Chaque utilisateur choisit ses couleurs dans « Interface visuelle », selon la règle **60 / 30 / 10** :

| Rôle | Champ | Variable CSS |
|---|---|---|
| Couleur dominante (60 %) | `color_fond` | `--nav-bg-color` |
| Couleur d'accent (30 %) | `color` | `--primary-color` |
| Couleur de touche (10 %) | `color_tiers` | `--tertiary-color` |

- **Associations prêtes à l'emploi** : 36 associations de trois couleurs, classées par famille (Néon, Afrique, Royaux, Nature…).
- **Contraste automatique** : le texte passe en noir ou en blanc selon la clarté de la couleur.
- **Menu des modules** : il n'est jamais dominé par le rouge.
- **Mode sombre**, favoris et modules récents sont mémorisés par utilisateur.
- **Thème d'institution** : une institution peut imposer son propre thème.

---

## Sécurité

À vérifier avant toute mise en ligne :

- [ ] **Secrets hors du code** : `SECRET_KEY` et `EMAIL_HOST_PASSWORD` dans `.env`, jamais dans `settings.py` ni dans Git. S'ils ont déjà été partagés ou versionnés, **régénérez-les**.
- [ ] `DEBUG = False` en production.
- [ ] HTTPS activé, avec ces réglages :
  ```python
  SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
  SECURE_SSL_REDIRECT = True
  SESSION_COOKIE_SECURE = True
  CSRF_COOKIE_SECURE = True
  SECURE_HSTS_SECONDS = 31536000
  SECURE_CONTENT_TYPE_NOSNIFF = True
  ```
- [ ] `CSRF_TRUSTED_ORIGINS` : ne garder que `https://iacs.operaplus.org` en production.
- [ ] `debug_toolbar` retiré de `INSTALLED_APPS` en production.
- [ ] Limitation des tentatives de connexion sur `/log/`, contre la force brute.
- [ ] Sauvegardes PostgreSQL testées, avec une restauration réelle.
- [ ] Vérification de la configuration : `python manage.py check --deploy`.

---

## Mise en production

Exemple avec Gunicorn derrière Nginx :

```bash
pip install gunicorn
python manage.py collectstatic --noinput
python manage.py migrate --noinput
gunicorn Opera_CTN.wsgi:application --bind 127.0.0.1:8000 --workers 3
```

Dans Nginx :
- `/static/` pointe vers `STATIC_ROOT` et `/media/` vers `MEDIA_ROOT` ;
- le reste est transmis à Gunicorn, avec l'en-tête `X-Forwarded-Proto`.

Celery (worker et beat) et Redis tournent comme services `systemd`.

**Tailwind** : en production, remplacez le script `cdn.tailwindcss.com` par un CSS compilé. La marche à suivre est dans `vitrine/tailwind/README.md`.

---

## Conventions de développement

- **Gabarits** : on n'écrit jamais de balise `{% %}` ni de variable `{{ }}` dans un commentaire HTML `<!-- -->`, car Django les interprète. On utilise `{# … #}` ou `{% comment %}`.
- **Formulaires** : en HTML écrit à la main, validés côté serveur.
- **Modifications d'interface** : on ajoute par-dessus l'existant. On ne renomme pas les ids, classes, noms de champs, variables Django ni fonctions JavaScript déjà utilisés.
- **Couleurs** : toujours les variables du thème (`--nav-bg-color`, `--primary-color`, `--tertiary-color`), jamais de couleur en dur pour les éléments principaux.
- **Langue** : interface et messages en français. Les textes à traduire passent par `gettext`.

---

## Dépannage

| Message | Cause probable | Solution |
|---|---|---|
| `ModuleNotFoundError: No module named 'vitrine'` | Dossier `vitrine/` mal placé | Le mettre à côté de `manage.py` |
| `IndentationError` dans `settings.py` | Ligne collée avec des espaces en début de ligne | Coller la ligne au bord gauche |
| `Application labels aren't unique` | Application déclarée deux fois | Une seule entrée dans `INSTALLED_APPS` |
| `'block' tag with name '…' appears more than once` | Balise `{% block %}` dans un commentaire HTML | Utiliser `{# … #}` |
| `Invalid template library … cannot import name` | Fichiers de `vitrine/templatetags/` copiés dans une autre application | Les supprimer de cette application |
| `DisallowedHost` | Domaine absent de `ALLOWED_HOSTS` | L'ajouter dans `settings.py` |
| Formulaires refusés (403 CSRF) | Origine absente de `CSRF_TRUSTED_ORIGINS` | Ajouter l'URL complète, avec `https://` |

---

## Liens

- Communauté MEAL Afrique : journal et réseau des professionnels du suivi-évaluation, lié à OperaPlus depuis le site vitrine.
- Documentation Django : <https://docs.djangoproject.com/fr/>

© OperaPlus — tous droits réservés.
