# Référencement naturel — MEAL Afrique et OperaPlus

Un seul module Django, `referencement`, installé à l'identique dans les deux projets.
Seuls les réglages (`REFERENCEMENT` dans `settings.py`) changent d'un site à l'autre.

---

## 1. Ce que fait le module

| Élément | Où | Rôle |
|---|---|---|
| `<title>`, meta description, URL canonique, robots | `{% seo %}` | Ce que Google affiche dans ses résultats |
| Open Graph et Twitter | `{% seo %}` | L'aperçu (titre, image, résumé) quand un lien est partagé sur WhatsApp, Facebook, LinkedIn, X |
| Données structurées WebSite et Organisation | `{% seo %}` sur la page d'accueil | Nom du site, logo, réseaux, champ de recherche, lien vers l'autre site |
| Données structurées NewsArticle | `{% seo_article objet %}` | Articles éligibles à Google Actualités et aux résultats enrichis |
| Fil d'Ariane | `{% seo_ariane … %}` | Chemin affiché sous le titre dans Google |
| FAQ | `{% seo_faq … %}` | Pour une page « Questions fréquentes » |
| Logiciel | `{% seo_logiciel … %}` | Page publique d'OperaPlus |
| `/sitemap.xml` | automatique | Liste de toutes les pages publiques, avec leurs dates |
| `/sitemap-news.xml` | automatique | Articles publiés depuis moins de 2 jours (Google Actualités) |
| `/robots.txt` | automatique | Pages interdites aux robots, adresse des sitemaps |
| `X-Robots-Tag: noindex` | middleware | Empêche l'indexation des pages privées, même si un lien y mène |
| `manage.py audit_seo` | commande | Vérifie titres, descriptions, H1, images, canonique, données structurées |
| `{% seo_icones %}`, `/favicon.ico` | gabarit de base | Icône de l'onglet, de l'écran d'accueil du téléphone et des résultats Google |
| `manage.py generer_icones` | commande | Fabrique toutes les icônes à partir d'une image carrée |
| Redirections 301 automatiques | modèle + middleware | Changer l'adresse d'un article ne casse plus les liens ni le classement |
| IndexNow | signaux | Bing, Yandex, Seznam… prévenus dès qu'un article est publié, modifié ou supprimé |
| `/flux.xml` | automatique | Flux RSS (agrégateurs, Google Actualités, Feedly, LinkedIn) |
| Images dans `sitemap.xml` | automatique | Les illustrations remontent dans Google Images |
| `{% articles_lies %}` | gabarit d'article | Bloc « À lire aussi » : maillage interne automatique |
| `{% seo_auteur %}` + auteur dans NewsArticle | pages auteurs | Montre l'expertise des rédacteurs à Google (E-E-A-T) |
| `{% seo_evenement %}` | agenda | Événements éligibles aux résultats enrichis |
| hreflang fr / en / x-default | `{% seo %}` + sitemap | Chaque visiteur reçoit la version dans sa langue ; pas de contenu dupliqué entre langues |

---

## 2. Installation (identique dans les deux projets)

1. Copier le dossier `referencement/` à côté des autres applications.
2. `settings.py` :

```python
INSTALLED_APPS += ['django.contrib.sitemaps', 'referencement']

MIDDLEWARE += [
    'referencement.middleware.NonIndexationMiddleware',   # après SecurityMiddleware
    'referencement.middleware.RedirectionMiddleware',     # en DERNIER
]

# Le processeur « request » doit être actif (il l'est par défaut) :
# TEMPLATES[0]['OPTIONS']['context_processors'] contient 'django.template.context_processors.request'

# Derrière Nginx / un proxy : pour que les URL générées soient en https et sur le bon domaine
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
```

3. Créer la table des redirections : `python manage.py migrate referencement`

4. `urls.py` principal :

```python
path('', include('referencement.urls')),     # robots.txt, sitemap.xml, sitemap-news.xml
```

5. Dans le gabarit de base (le `<head>` commun à toutes les pages) :

```django
{% load referencement %}
<html lang="{% seo_langue %}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {% block seo %}{% seo %}{% endblock %}
    …
```

Supprime les anciennes balises `<title>` et `<meta name="description">` écrites à la main : elles feraient doublon.

---

## 3. Réglages

### MEAL Afrique

```python
REFERENCEMENT = {
    'NOM': 'MEAL Afrique',
    'URL': 'https://www.mealafrique.com',                 # ton vrai domaine, en https, sans « / » final
    'DESCRIPTION': 'Le journal du suivi-évaluation en Afrique : actualités, débats, méthodes et outils MEAL pour les praticiens.',
    'LANGUE': 'fr',
    'REGION': 'fr_CM',
    'IMAGE': '/static/img/partage-mealafrique.jpg',       # 1200 × 630 px, moins de 300 Ko
    'LOGO': '/static/img/logo-mealafrique.png',           # carré, au moins 112 × 112 px
    'TWITTER': '@…',
    'RESEAUX': ['https://www.linkedin.com/company/…', 'https://www.facebook.com/…'],
    'TYPE_ORGANISATION': 'NewsMediaOrganization',
    'SITES_LIES': [{'nom': 'OperaPlus', 'url': 'https://…', 'description': 'La plateforme de suivi-évaluation'}],
    'PRIVE': ['/admin/', '/compte/', '/connexion/'],
    'RECHERCHE': '/recherche/?q={search_term_string}',    # seulement si une page de recherche existe
    'SITEMAPS': {
        'pages':      {'urls': ['/', '/a-propos/', '/contact/'], 'priorite': 1.0},
        'actualites': {'modele': 'journal.Actualite', 'date': 'date_publication', 'filtre': {'publie': True},
                       'news': True, 'titre': 'titre', 'frequence': 'daily'},
        'debats':     {'modele': 'journal.Debat', 'date': 'date_publication', 'news': True, 'titre': 'titre'},
        'rubriques':  {'modele': 'journal.Rubrique', 'priorite': 0.5},
    },
}
```

Remplace `journal.Actualite` par `nom_de_l_app.NomDuModele`, et `date_publication` / `publie` par tes vrais noms de champs.
Chaque modèle listé doit avoir une méthode `get_absolute_url()`.

### OperaPlus

```python
REFERENCEMENT = {
    'NOM': 'OperaPlus',
    'URL': 'https://…',
    'DESCRIPTION': 'OperaPlus, la plateforme de suivi-évaluation (MEAL) pour les projets et programmes : planification, indicateurs, collecte hors ligne, tableaux de bord.',
    'LANGUE': 'fr', 'REGION': 'fr_CM',
    'IMAGE': '/static/img/partage-operaplus.jpg', 'LOGO': '/static/img/logo-operaplus.png',
    'TYPE_ORGANISATION': 'Organization',
    'SITES_LIES': [{'nom': 'MEAL Afrique', 'url': 'https://www.mealafrique.com', 'description': 'Le journal du suivi-évaluation'}],
    # L'application elle-même ne doit JAMAIS être indexée : tout ce qui n'est pas la vitrine est privé.
    'PRIVE': ['/admin/', '/evaluer/', '/detail-gantt/', '/microplan', '/configurations', '/champs-indicateurs/',
              '/saisie-plus/', '/grub_form/', '/send-transaction/', '/api/', '/archive/', '/completude-collecte/'],
    'SITEMAPS': {'vitrine': {'urls': ['/', '/fonctionnalites/', '/tarifs/', '/contact/'], 'priorite': 1.0}},
}
```

Complète `PRIVE` avec les autres préfixes de l'application. La commande `audit_seo` signale toute page publique passée en noindex par erreur.

### Serveur de test

```python
REFERENCEMENT['INDEXER'] = False     # tout le site en noindex, robots.txt « Disallow: / »
```

---

## 3 bis. Icônes (favicon)

1. Fabriquer les fichiers à partir d'une image carrée d'au moins 512 × 512 px (le symbole seul, sans texte) :

```
python manage.py generer_icones chemin/vers/logo-carre.png --dossier ctn_bpf/static/img --fond "#123A37"
```

   Elle crée `favicon.ico` (16, 32 et 48 px), `icone-192.png`, `icone-512.png` et `apple-touch-icon.png` (fond plein).
   Si tu as un `favicon.svg`, mets-le aussi dans `static/img/`.

2. Les déclarer dans `REFERENCEMENT` :

```python
'ICONES': {
    'ICO': 'img/favicon.ico',
    'SVG': 'img/favicon.svg',               # facultatif
    'PNG': 'img/icone-192.png',
    'APPLE': 'img/apple-touch-icon.png',
    'MANIFESTE': 'manifest.webmanifest',    # seulement si la PWA en a déjà un
    'COULEUR': '#123A37',                   # couleur de la barre du navigateur sur mobile
},
```

3. Dans le gabarit de base, dans le `<head>` de toutes les pages : `{% seo_icones %}`.
   Supprime les anciennes balises `<link rel="icon">` et `<link rel="apple-touch-icon">`.

`/favicon.ico` à la racine redirige automatiquement vers le fichier de `static/`.
Garde toujours les mêmes noms de fichiers : Google met plusieurs jours, voire plus, à prendre en compte une nouvelle icône.

---

## 4. Utilisation dans les gabarits

**Page simple** (rubrique, à propos…) :

```django
{% block seo %}{% seo titre="Débats" description="Les débats de MEAL Afrique : chaque mois, une question qui divise les évaluateurs." %}{% endblock %}
```

**Article ou débat** :

```django
{% block seo %}
  {% seo titre=actualite.titre description=actualite.chapeau image=actualite.image.url type="article"
         date_publication=actualite.date_publication date_modification=actualite.date_modification auteur=actualite.auteur %}
  {% seo_article actualite %}
  {% seo_ariane "Accueil" "/" actualite.rubrique.nom actualite.rubrique.get_absolute_url actualite.titre %}
{% endblock %}
```

`seo_article` trouve tout seul les champs usuels : `titre`, `chapeau` (ou `resume`, `description`, `contenu`),
`image`, `date_publication`, `date_modification`, `auteur`.

**Page d'accueil d'OperaPlus** :

```django
{% block seo %}{% seo %}{% seo_logiciel "OperaPlus" "Plateforme de suivi-évaluation pour planifier, collecter hors ligne et piloter les indicateurs de vos projets." %}{% endblock %}
```

**Page de questions fréquentes** :

```django
{% seo_faq "Qu'est-ce que le MEAL ?" "Le MEAL (Monitoring, Evaluation, Accountability and Learning) est…" "OperaPlus fonctionne-t-il hors ligne ?" "Oui…" %}
```

Le texte des questions doit aussi être visible sur la page.

---

## 5. Règles d'écriture (ce que le module ne peut pas faire à ta place)

| Élément | Règle |
|---|---|
| Titre d'article | 50 à 60 caractères, mot-clé principal au début. « Évaluation à mi-parcours : 5 erreurs à éviter » plutôt que « Notre nouvel article ». |
| Chapeau (meta description) | 120 à 158 caractères, une promesse concrète. Il est repris tel quel sous le titre dans Google. |
| Un seul `<h1>` par page | Le titre de l'article. Les intertitres en `<h2>`, puis `<h3>`. |
| Adresse (slug) | Courte, en minuscules, sans accents ni dates : `/actualites/evaluation-mi-parcours/`. Ne jamais la changer après publication (sinon une redirection 301). |
| Images | Texte alternatif (`alt`) qui décrit l'image. Format WebP, largeur adaptée (≤ 1600 px), `loading="lazy"` sauf la première image. `width` et `height` renseignés. |
| Liens internes | Chaque article renvoie vers 2 ou 3 articles proches et vers sa rubrique, avec un texte de lien parlant (pas « cliquez ici »). |
| Pages vides | Une rubrique sans article, une page « en construction » : à ne pas publier, ou en `noindex` (`{% seo indexer=False %}`). |
| Contenu | Original, signé, daté. Google valorise l'expérience de terrain : chiffres, pays, programmes, leçons tirées. |

---

## 6. Mots-clés à viser

### MEAL Afrique (journal)

- **Cœur** : suivi-évaluation, suivi et évaluation de projet, MEAL, S&E, redevabilité, apprentissage organisationnel.
- **Méthodes** (des articles « guides » durables) : cadre logique, théorie du changement, indicateurs SMART, évaluation à mi-parcours, évaluation finale, évaluation d'impact, termes de référence d'une évaluation, enquête de base (baseline), plan de suivi-évaluation, collecte de données mobile.
- **Géographie** (longue traîne) : « suivi-évaluation Cameroun », « évaluation de projets au Sénégal », « MEAL Afrique de l'Ouest », « évaluation humanitaire RDC ».
- **Formats qui se partagent** : débats numérotés, modèles à télécharger (cadre logique vierge, matrice d'indicateurs, TdR type), glossaire du suivi-évaluation.

### OperaPlus (vitrine)

- logiciel de suivi-évaluation, plateforme MEAL, application de suivi de projets pour ONG, suivi des indicateurs de projet, collecte de données hors ligne, tableau de bord de projet, planification RACI, diagramme de Gantt de projet.

Une page = une intention. Exemple : une page `/fonctionnalites/collecte-hors-ligne/` pour « collecte de données hors ligne », plutôt qu'une seule page qui parle de tout.

---

## 7. Le lien permanent entre MEAL Afrique et OperaPlus

- **Données structurées** : chaque site déclare l'autre dans `SITES_LIES` (déjà en place sur la page d'accueil).
- **MEAL Afrique vers OperaPlus** : dans les articles « méthodes » (cadre logique, indicateurs, collecte…), un encadré « Mettre en pratique avec OperaPlus » qui renvoie vers la page de la fonctionnalité correspondante.
- **OperaPlus vers MEAL Afrique** : une rubrique « Ressources » sur la vitrine, qui liste les 5 derniers guides de MEAL Afrique ; un lien dans le pied de page des deux sites.
- **Liens naturels** : pas de liens cachés ni de répétition dans chaque paragraphe ; un ou deux liens utiles par article suffisent.
- **Mesure** : ajouter `?utm_source=mealafrique&utm_medium=article` aux liens vers OperaPlus, pour voir dans les statistiques combien de visiteurs viennent du journal.

---

## 8. Après la mise en ligne

1. **Google Search Console** (search.google.com/search-console) : ajouter chaque domaine (propriété « Domaine », vérifiée par un enregistrement DNS), puis soumettre `/sitemap.xml` et, pour MEAL Afrique, `/sitemap-news.xml`.
2. **Bing Webmaster Tools** : importer directement les sites depuis Search Console.
3. **Google Publisher Center** (MEAL Afrique) : déclarer la publication pour Google Actualités.
4. **Tester** une page d'article avec le Test des résultats enrichis de Google, et l'aperçu de partage avec l'outil de débogage de Facebook ou de LinkedIn.
5. **Lancer** `python manage.py audit_seo` après chaque gros changement de gabarit.
6. **Suivre chaque mois** dans Search Console : pages indexées, requêtes qui amènent des visiteurs, taux de clic, rapport Core Web Vitals.

---

## 9. Performance (compte dans le classement)

Google mesure trois indicateurs sur les vrais visiteurs : affichage du contenu principal (LCP, viser moins de 2,5 s), réactivité (INP, moins de 200 ms), stabilité de la page (CLS, moins de 0,1).

Points concrets pour tes projets :

- **Tailwind en production** : certaines pages chargent `cdn.tailwindcss.com`, qui compile le CSS dans le navigateur à chaque visite. Pour les pages publiques, génère un fichier CSS une fois (`npx tailwindcss -o static/css/site.css --minify`) et charge ce fichier.
- **Bibliothèques en double** : jQuery et Bootstrap chargés plusieurs fois (vu sur la page Paramètres) ralentissent tout ; un seul exemplaire par page.
- **Polices** : `font-display: swap`, et seulement les graisses utilisées.
- **Images** : WebP, dimensions indiquées, `loading="lazy"` sous la ligne de flottaison.
- **Serveur** : compression gzip ou brotli dans Nginx, cache long pour `/static/` (fichiers versionnés par `ManifestStaticFilesStorage`).
- **HTTPS partout** et une seule adresse : redirection 301 de `http://` et de la version sans `www` (ou avec) vers l'adresse choisie.

---

## 10. Plan sur 90 jours (MEAL Afrique)

| Période | À faire |
|---|---|
| Semaine 1 | Installer le module, régler `REFERENCEMENT`, corriger ce que signale `audit_seo`, Search Console + sitemaps. |
| Semaines 2–4 | Réécrire titres et chapeaux des 20 articles les plus lus. Créer les pages de rubrique avec un texte d'introduction de 150 mots. |
| Mois 2 | Publier 4 guides de fond (cadre logique, théorie du changement, indicateurs SMART, TdR d'évaluation), chacun avec un modèle téléchargeable et un encadré OperaPlus. |
| Mois 3 | Un débat par mois relayé sur LinkedIn et dans les réseaux d'évaluateurs ; proposer des tribunes croisées à des associations nationales d'évaluation et à des universités pour obtenir des liens entrants. |
| Chaque mois | Lire les requêtes dans Search Console : une requête avec beaucoup d'affichages et peu de clics = un titre ou un chapeau à réécrire. |

---

## 11. Haut niveau

### 11.1 Redirections 301 automatiques

Rien à faire : pour chaque modèle déclaré dans `SITEMAPS`, quand l'adresse d'un contenu **public** change
(slug, titre, rubrique…), l'ancienne adresse renvoie en 301 vers la nouvelle.

- Les chaînes sont raccourcies : A → B puis B → C devient A → C.
- Revenir à l'ancienne adresse supprime la redirection (jamais de boucle).
- Un brouillon renommé ne crée rien.
- Les paramètres (`?utm_source=…`) sont conservés.
- Les redirections se gèrent aussi à la main dans l'administration (**Référencement naturel → Redirections**),
  par exemple pour une page supprimée ; le nombre de visites redirigées y est affiché.

### 11.2 IndexNow (indexation instantanée)

```python
'INDEXNOW': {'CLE': 'colle-ici-ta-cle'},
```

Générer une clé : `python -c "import secrets; print(secrets.token_hex(16))"`.
La clé est servie toute seule à `https://ton-site/<clé>.txt`. Dès qu'un contenu public est créé, modifié
ou supprimé, son adresse est envoyée à Bing, Yandex, Seznam, Naver… en tâche de fond (la sauvegarde n'attend pas).
Rien n'est envoyé si `DEBUG = True` ou `INDEXER = False`. Google ne participe pas à IndexNow : pour lui, ce sont
les sitemaps et Search Console.

### 11.3 Flux RSS et images

Dans `SITEMAPS`, pour chaque modèle :

```python
'actualites': {'modele': 'journal.Actualite', 'date': 'date_publication', 'filtre': {'publie': True},
               'news': True, 'flux': True, 'image': 'image', 'lies': 'rubrique', 'langue': 'langue'},
```

- `'flux': True` : le modèle entre dans `/flux.xml` (30 derniers contenus, avec l'image jointe). Le flux est annoncé automatiquement dans le `<head>`.
- `'image': 'image'` : nom du champ image ; l'illustration est ajoutée au sitemap pour Google Images.

### 11.4 Maillage interne : « À lire aussi »

```django
{% articles_lies actualite 3 %}
{% articles_lies actualite 4 "Sur le même sujet" %}
```

D'abord les contenus publiés de la même rubrique (réglage `'lies'`), puis les plus récents ; même langue ; jamais l'article lui-même.
Pour l'adapter à ton design : copie `referencement/templates/referencement/articles_lies.html` dans
`templates/referencement/articles_lies.html` de ton projet, et garde les mêmes variables.

### 11.5 Auteurs (E-E-A-T : expérience, expertise, autorité, fiabilité)

Google valorise les contenus signés par des personnes identifiables. Si `actualite.auteur` est un objet
(un modèle `Auteur` avec `get_absolute_url()`), `{% seo_article %}` publie automatiquement son nom, sa fonction,
sa photo, sa biographie, son LinkedIn et le lien vers sa page. Champs lus : `nom`, `fonction`, `photo`, `biographie`,
`linkedin`, `twitter`, `site_web`.

Sur la page de l'auteur :

```django
{% block seo %}{% seo titre=auteur.nom description=auteur.biographie type="profile" %}{% seo_auteur auteur %}{% endblock %}
```

Sur cette page, liste ses articles : c'est ce qui donne du poids à sa signature.

### 11.6 Agenda : événements

```django
{% block seo %}{% seo titre=evenement.titre description=evenement.description %}{% seo_evenement evenement %}{% endblock %}
```

Champs lus : `titre`, `description`, `date_debut`, `date_fin`, `lieu`, `ville`, `pays` (code à 2 lettres, ex. `CM`),
`en_ligne`, `lien`, `image`, `organisateur`. Un événement en salle **et** en ligne est déclaré hybride.

### 11.7 Site bilingue (français et anglais)

**Dans Django :**

```python
# settings.py
USE_I18N = True
LANGUAGE_CODE = 'fr'
LANGUAGES = [('fr', 'Français'), ('en', 'English')]
MIDDLEWARE = [ …, 'django.contrib.sessions.middleware.SessionMiddleware',
               'django.middleware.locale.LocaleMiddleware',       # juste après SessionMiddleware
               'django.middleware.common.CommonMiddleware', … ]

REFERENCEMENT = {
    …,
    'LANGUES': {'fr': '', 'en': ''},           # préfixes /fr/ et /en/ sur le même domaine
    'LANGUE_DEFAUT': 'fr',                     # version proposée aux autres langues (x-default)
    'REGIONS': {'fr': 'fr_CM', 'en': 'en_CM'},
}
```

```python
# urls.py
from django.conf.urls.i18n import i18n_patterns

urlpatterns = [
    path('', include('referencement.urls')),     # robots.txt, sitemaps, flux : HORS des préfixes de langue
    path('admin/', admin.site.urls),
] + i18n_patterns(
    path('', views.accueil, name='accueil'),
    path('actualites/<slug:slug>/', views.actualite, name='actualite'),
    …
)
```

Si tu préfères un domaine par langue : `'LANGUES': {'fr': 'https://www.mealafrique.com', 'en': 'https://en.mealafrique.com'}`.

**Pour les articles**, qui ne sont pas tous traduits : ajoute au modèle un champ `langue` et une méthode `traductions()`.
Seules les traductions qui existent vraiment sont déclarées (jamais de lien vers une page vide) :

```python
class Actualite(models.Model):
    langue = models.CharField(max_length=2, choices=[('fr', 'Français'), ('en', 'English')], default='fr')
    traduction_de = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='traductions_set')
    …
    def get_absolute_url(self):
        return '/%s/actualites/%s/' % (self.langue, self.slug)

    def traductions(self):
        original = self.traduction_de or self
        versions = [original] + list(original.traductions_set.filter(publie=True))
        return {v.langue: v for v in versions}
```

Dans le gabarit de l'article, passe l'objet : `{% seo titre=actualite.titre … objet=actualite %}`,
et `'langue': 'langue'` dans la configuration `SITEMAPS` du modèle.

Ce que fait alors le module :

- `<link rel="alternate" hreflang="fr|en|x-default">` sur chaque page, et `<html lang>` qui suit la langue active ;
- `og:locale` (`fr_CM` / `en_CM`) et `og:locale:alternate` pour les aperçus de partage ;
- le sitemap déclare, pour chaque adresse, ses équivalents dans l'autre langue ;
- le sitemap Google Actualités indique la langue de chaque article ;
- le flux RSS et « À lire aussi » restent dans la langue de la page.

**À éviter :** traduire automatiquement tous les articles sans relecture. Google traite les traductions
automatiques non relues comme du contenu de faible qualité. Mieux vaut 20 articles anglais soignés
(les guides de fond, les débats phares) que 300 traductions brutes.

### 11.8 Ordre d'installation conseillé

1. Mettre à jour le dossier `referencement/`, puis `python manage.py migrate referencement`.
2. Ajouter `RedirectionMiddleware` en dernier dans `MIDDLEWARE`.
3. Générer la clé IndexNow et l'ajouter aux réglages.
4. Compléter `SITEMAPS` : `flux`, `image`, `lies` (et `langue` si bilingue).
5. Ajouter `{% articles_lies %}` dans le gabarit d'article, `{% seo_auteur %}` et `{% seo_evenement %}` dans les leurs.
6. Bilingue : `LocaleMiddleware`, `LANGUAGES`, `i18n_patterns`, puis `langue` et `traductions()` sur les modèles.
7. Lancer `python manage.py audit_seo`, puis soumettre de nouveau les sitemaps dans Search Console.

### 11.9 Reprendre les blocs d'un gabarit existant (`{% seo_capture %}`)

Si tes pages enfants remplissent déjà des blocs (`title`, `meta_description`, `og_image`…), garde-les :
`{% seo_capture %}` lit le contenu d'un bloc sans l'afficher, et le passe à `{% seo %}`.

```django
{% seo_capture "seo_titre" %}{% block title %}OperaPlus · Logiciel MEAL{% endblock %}{% fin_seo_capture %}
{% seo_capture "seo_description" %}{% block meta_description %}…{% endblock %}{% fin_seo_capture %}
{% seo_capture "seo_robots" %}{% block robots %}index, follow{% endblock %}{% fin_seo_capture %}
{% seo titre_exact=seo_titre description=seo_description robots=seo_robots %}
```

- `titre_exact` : titre utilisé tel quel (sans « · Nom du site » ajouté) ;
- `titre_partage` : titre des aperçus de partage (ancien bloc `og_title`) ;
- `locale` : `og:locale` imposé (ancien bloc `og_locale`, ex. `en_US` sur la page anglaise) ;
- `robots` : un « noindex » écrit dans le bloc d'une page enfant est respecté ;
- `image` : un chemin (`/static/…`) ou un champ image.

Attention : dans un gabarit Django, `{# … #}` ne marche que sur UNE ligne. Pour un commentaire sur plusieurs lignes,
utilise `{% comment %} … {% endcomment %}`, sinon les balises écrites dans le commentaire sont exécutées.
