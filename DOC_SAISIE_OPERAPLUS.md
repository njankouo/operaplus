# OperaPlus — Formulaires de collecte et saisie des données

**Documentation technique détaillée · version du 5 novembre 2026**

> Documentation personnelle. Elle décrit, pièce par pièce, comment un formulaire est conçu, affiché, rempli, contrôlé, enregistré et rechargé dans OperaPlus, avec le *pourquoi* de chaque choix, des exemples chiffrés et le code de référence en annexe. Aucun secret n'y figure.

---

## Sommaire

- [0. Comment lire cette documentation](#0-comment-lire-cette-documentation)
- [1. Vue d'ensemble](#1-vue-densemble)
- [2. Le parcours complet d'une donnée, pas à pas](#2-le-parcours-complet-dune-donnée-pas-à-pas)
- [3. Le modèle de données](#3-le-modèle-de-données)
- [4. Natures et types de champ](#4-natures-et-types-de-champ)
- [5. Le designer de formulaires](#5-le-designer-de-formulaires)
- [6. Le moteur de saisie `op-form-runtime.js`](#6-le-moteur-de-saisie-op-form-runtimejs)
- [7. La page de saisie `saisie_donnees.html`](#7-la-page-de-saisie-saisie_donneeshtml)
- [8. La normalisation des valeurs (`valeurs.py`)](#8-la-normalisation-des-valeurs-valeurspy)
- [9. L'enregistrement (`save_value`)](#9-lenregistrement-save_value)
- [10. Le rechargement (`load_data` et API valeurs)](#10-le-rechargement-load_data-et-api-valeurs)
- [11. L'application `saisie_plus`](#11-lapplication-saisie_plus)
- [12. Pièces jointes : fichiers et photos](#12-pièces-jointes--fichiers-et-photos)
- [13. Anti-doublons](#13-anti-doublons)
- [14. Reçu d'enregistrement](#14-reçu-denregistrement)
- [15. Effacement d'une valeur](#15-effacement-dune-valeur)
- [16. Indicateurs et indicateurs composites](#16-indicateurs-et-indicateurs-composites)
- [17. Le design de la page de saisie](#17-le-design-de-la-page-de-saisie)
- [18. Installation et déploiement](#18-installation-et-déploiement)
- [19. Tests et vérifications](#19-tests-et-vérifications)
- [20. Dépannage détaillé](#20-dépannage-détaillé)
- [21. Règles de développement](#21-règles-de-développement)
- [22. Reste à faire](#22-reste-à-faire)
- [23. Glossaire](#23-glossaire)
- [Annexes : code de référence](#annexes--code-de-référence)

---

## 0. Comment lire cette documentation

- Les **noms techniques** (fichiers, fonctions, champs) sont écrits `comme ceci`. Ils correspondent exactement au code.
- Les sections 2 à 4 expliquent **le fonctionnement**. Les sections 5 à 16 détaillent **chaque pièce**. Les sections 18 à 20 servent **en exploitation** (installation, tests, pannes).
- Un exemple fil rouge revient partout : le formulaire **« Suivi mensuel du point d'eau »**, rempli pour l'unité **« Forage Akwa »**, période **« Octobre 2026 »**.
- Le code complet des fichiers serveur est en **annexe** : quand une section dit « voir A2 », c'est l'annexe A2.

---

## 1. Vue d'ensemble

### 1.1 Où se trouve quoi

| Élément | Emplacement | Rôle |
|---|---|---|
| Dépôt | GitHub `njankouo/operaplus` | Code source |
| Application principale | `ctn_bpf/` | Modèles (`DataElement`, `DataSet`, `DSet_DElt`, `Indicateur`…), vues historiques (`save_value`, `load_data`, `get_elements`…) |
| Application d'extension | `saisie_plus/` (racine du projet) | Toutes les nouveautés côté serveur, montées sur `/saisie-plus/` |
| Templates | `webpages/templates/webpages/ctn_bpf/` | Pages HTML |
| Fichiers statiques | `ctn_bpf/static/` → servis sous `/static/` | `op-designer-pro.js` (designer), `op-form-runtime.js` (moteur de saisie) |
| Serveur de production | `/home/PlateformeOperaPlus`, conteneur Docker `meal-app-web` | Application Django |
| Proxy | `/home/infrastructure/proxy` | nginx (statiques, médias, HTTPS) |
| Poste de développement | Fedora, `~/Documents/PlateformeOperaPlus` | Tests locaux |

### 1.2 Les cinq pages du parcours

| Ordre | Page | Template | Ce qu'on y fait |
|---|---|---|---|
| 1 | Data elements | `dataelts.html` | Créer chaque donnée à collecter et choisir sa **nature** (Nombre, Texte, Date, Fichier) |
| 2 | Configuration du formulaire | `dataset_modif.html` | Rattacher au formulaire ses éléments et ses indicateurs |
| 3 | Création d'indicateur | `creer_indicateur.html` | Écrire la formule d'un indicateur (`$id$` = élément, `#id#` = indicateur) |
| 4 | Designer | `data_sets_design.html` | Dessiner le formulaire (tableaux, questions, règles) |
| 5 | Saisie | `saisie_donnees.html` | Remplir le formulaire pour une unité et une période, puis enregistrer |

### 1.3 Les trois idées qui structurent tout

1. **Le HTML du formulaire est la source de vérité de l'affichage.** Le designer produit un HTML ordinaire dont les champs s'appellent `D0elt<ID>` et portent des attributs `data-op-*`. La page de saisie ne fait que l'interpréter.
2. **Le serveur est la source de vérité des valeurs.** La page peut se tromper ou être modifiée : le serveur re-contrôle et range chaque valeur selon la nature de l'élément (`valeurs.py`).
3. **On ajoute, on ne remplace pas.** Le code historique (noms, ids, fonctions) n'est jamais renommé : les nouveautés l'enveloppent ou s'y ajoutent. Conséquence : tout reste compatible, mais les couches s'empilent (voir §21).

---

## 2. Le parcours complet d'une donnée, pas à pas

Exemple : l'élément **« Photo du point d'eau »** et l'élément **« Ménages desservis »**.

### Étape 1 — Création de l'élément (Data elements)

L'administrateur crée :

| id | `m_name` | `m_value_type` |
|---|---|---|
| 12 | Ménages desservis | `Number` |
| 18 | Photo du point d'eau | `File` |

La nature décide **dans quelle colonne** la valeur sera rangée plus tard (`m_value` pour 12, `fichier_element` pour 18).

### Étape 2 — Rattachement au formulaire (configuration)

Le formulaire « Suivi mensuel du point d'eau » (`DataSet` id 158) reçoit les éléments 12 et 18 dans `m_dataelements`.

### Étape 3 — Dessin (designer)

Un clic sur chaque élément insère :

```html
<tr><td>Ménages desservis</td>
    <td><input class="form-control" name="D0elt12" type="number" data-op-type="int" data-op-int="1" data-op-required="1" value="0" /></td></tr>
<tr><td>Photo du point d'eau</td>
    <td><input class="form-control" name="D0elt18" type="text" readonly data-op-type="photo" data-op-accept="image/*" placeholder="📷 Photo prise sur le terrain" /></td></tr>
```

Le designer a choisi `int` (le libellé commence par « Ménages… » et la nature est Nombre) et `photo` (nature Fichier, libellé contenant « Photo »). Ce HTML est enregistré dans `DataSet.m_formulaire`.

### Étape 4 — Ouverture de la saisie

1. L'agent coche « Forage Akwa », choisit 2026, puis « Octobre 2026 », et clique **Charger les données**.
2. La page injecte le HTML du formulaire.
3. Le moteur `op-form-runtime.js` transforme les champs : le champ `D0elt18` devient invisible et un bloc « Appareil photo / Galerie » apparaît à sa place ; `D0elt12` devient obligatoire et entier.
4. La page demande les valeurs déjà enregistrées : `GET /saisie-plus/api/valeurs/<id Forage Akwa>/<id Octobre 2026>/?dataset=158`.

### Étape 5 — Saisie

- L'agent tape **42** dans « Ménages desservis ».
- Il touche **Appareil photo**, prend la photo : elle est réduite (≈ 4 Mo → < 1 Mo) puis envoyée **immédiatement** à `POST /saisie-plus/api/fichiers/`. Le serveur répond `{"id": 73, "nom": "IMG_2041.jpg", …}` et le champ caché `D0elt18` reçoit `73`.

### Étape 6 — Enregistrement

1. Contrôles : champ obligatoire rempli, entier, règles de cohérence.
2. Si une valeur est inhabituelle (écart de plus de 60 % avec septembre), l'agent peut la justifier.
3. Récapitulatif « avant / après ».
4. La page construit `elementsArea` :

```json
[{"id": "12", "value": "42", "type": "int"},
 {"id": "18", "value": "73", "type": "photo"}]
```

5. Envoi `POST /save_value/` (AJAX). Le serveur normalise : `12` → `m_value = 42.0` ; `18` → `fichier_element_id = 73` (après avoir vérifié que la pièce 73 appartient bien à l'agent).
6. Écriture dans `DSet_DElt` : une ligne par élément, unité et période (créée ou mise à jour).
7. Réponse : `{"ok": true, "message": "2 valeurs enregistrées : 2 nouvelles · 1 pièce jointe · 0 ignorée", "recu": {…}}`.
8. La page affiche le message et imprime le tampon « ENREGISTRÉ 10:42 · 2 valeurs » sur la fiche.

### Étape 7 — Rechargement (le lendemain)

`GET /saisie-plus/api/valeurs/…` renvoie :

```json
{"data": [
  {"id": 12, "content": 42, "texte": null, "date": null, "na": false, "fichier": null},
  {"id": 18, "content": null, "texte": null, "date": null, "na": false,
   "fichier": {"id": 73, "nom": "IMG_2041.jpg", "taille": 812000, "type": "image/jpeg",
               "url": "/saisie-plus/fichier/73/", "apercu": "/saisie-plus/fichier/73/?apercu=1"}}
]}
```

La page remet 42 dans le champ et affiche la miniature de la photo.

---

## 3. Le modèle de données

### 3.1 `DataElement` (ctn_bpf)

| Champ | Rôle |
|---|---|
| `m_name` | Libellé affiché |
| `m_value_type` | Nature : `Number`, `Text`, `Date`, `File` (choix ajouté : `("File", "Fichier")`) |

### 3.2 `DataSet` (ctn_bpf)

| Champ | Rôle |
|---|---|
| `m_dataelements` | Éléments du formulaire (ManyToMany) |
| `m_indicateurs` | Indicateurs du formulaire |
| `m_formulaire` | HTML produit par le designer |
| `m_structures` | Unités concernées (arborescence de la page de saisie) |

### 3.3 `DSet_DElt` (ctn_bpf) — une valeur saisie

C'est la table centrale : **une ligne = une valeur d'un élément, pour une unité et une période**.

| Champ | Type | Contenu | Exemple |
|---|---|---|---|
| `m_dataset_value` | FK `DataSetValue` | Envoi dont provient la dernière écriture | 5021 |
| `m_dataelement` | FK `DataElement` | L'élément | 12 |
| `m_structure` | FK `Structure` | L'unité | Forage Akwa |
| `periode` | FK `PeriodeOk` | La période | Octobre 2026 |
| `m_value` | `FloatField` null | Valeur des éléments **Nombre** | 42.0 |
| `texte_element` | `TextField` null | Valeur des éléments **Texte** | `+237677123456`, `1;3`, `08:30` |
| `date_element` | `DateField` null | Valeur des éléments **Date** | 2026-10-15 |
| `fichier_element` | FK `saisie_plus.PieceJointe` null | Valeur des éléments **Fichier** | 73 |
| `est_na` | `BooleanField` | « Non applicable » coché | False |
| `date_saisie` | `DateField` | Date de la dernière écriture | 2026-11-05 |
| `comment` | `TextField` **null** | `NULL` = saisie manuelle ; texte = cumul automatique (ex. « Cumul Mensuelle auto ») | NULL |
| `valeur_json` | facultatif | GPS `{"lat":…, "lng":…}`, choix multiples `["1","3"]` | — |

**Pourquoi une colonne par nature ?** Pour que les analyses puissent additionner `m_value` sans tomber sur du texte, filtrer par date sur `date_element`, et retrouver un fichier par une vraie clé étrangère. Mettre tout dans une seule colonne texte obligerait à reconvertir et deviner à chaque calcul.

**Pourquoi `comment` doit être `NULL` (et jamais `''`) pour une saisie manuelle ?** Parce que l'enregistrement retrouve la ligne existante avec `comment__isnull=True`. Une ligne avec `comment = ''` n'est pas trouvée : une **nouvelle** ligne est créée à chaque enregistrement, d'où les doublons (voir §13).

**Contrainte d'unicité** (à ajouter après le dédoublonnage) : une seule saisie manuelle par élément, unité et période.

```python
class Meta:
    constraints = [
        models.UniqueConstraint(fields=['m_dataelement', 'm_structure', 'periode'],
                                condition=models.Q(comment__isnull=True),
                                name='dset_delt_saisie_manuelle_unique'),
    ]
```

C'est une contrainte **partielle** : elle ne concerne que les saisies manuelles. Les cumuls automatiques (commentaire rempli) restent libres.

### 3.4 `DataSetValue` (ctn_bpf) — un envoi

Une ligne est créée à **chaque** enregistrement (`m_dataset`, `m_user`, `m_period_value`, `m_sub_period_value`). Elle sert d'historique des envois. Les lignes `DSet_DElt` pointent vers le dernier envoi qui les a écrites.

### 3.5 `IndicateurValeur` — valeur d'un indicateur au moment de la saisie

| Champ | Contenu |
|---|---|
| `indicateur_id` | L'indicateur |
| `periode_ok_id`, `structure_id`, `institution_id` | Où et quand |
| `valeur` | Résultat calculé par la page |
| `type_donnee` | `"valeur_form"` |
| `date_saisie` | Horodatage |

Une ligne par indicateur × unité × période × institution (`update_or_create`). **C'est une photo** : si la formule change plus tard, les anciennes valeurs ne bougent pas.

### 3.6 Modèles de `saisie_plus`

| Modèle | Champs principaux | Rôle |
|---|---|---|
| `JournalSaisie` | `dataset_id`, `structure_id`, `periode`, `user`, `nb_valeurs`, `nb_modifiees`, `date` | Traçabilité : « Dernière saisie : M. Ndongo, le 03/11/2026 à 14:20 » |
| `Justification` | `dataset_id`, `structure_id`, `periode`, `element_id`, `valeur`, `motif`, `texte`, `user` | Explication d'une valeur inhabituelle (une par élément/unité/période) |
| `EnTete` | `institution_id`, `dataset_id` (null = toute l'organisation), `logo`, `logo_partenaire`, `ligne1-3` | En-tête des fiches |
| `PieceJointe` | `fichier`, `nom`, `type_mime`, `taille`, `sha256`, `est_image`, `dataset_id`, `structure_id`, `periode`, `element_id`, `auteur`, `date` | Fichiers et photos joints |

Les identifiants (`dataset_id`, `structure_id`…) sont de simples entiers et non des clés étrangères : `saisie_plus` reste ainsi indépendante des modèles de `ctn_bpf` et s'installe sans migration croisée.

---

## 4. Natures et types de champ

### 4.1 Le principe

- La **nature** (page Data elements) = **où** la valeur est rangée.
- Le **type de champ** (designer, attribut `data-op-type`) = **comment** elle est saisie et contrôlée.
- Une nature accepte plusieurs types ; un type n'appartient qu'à une nature. Le designer refuse un type incompatible.

### 4.2 Tableau complet

| Type | Nature | Rendu à la saisie | Contrôles (page) | Normalisation (serveur) | Colonne | Exemple envoyé → stocké |
|---|---|---|---|---|---|---|
| `num` | Number | Champ nombre | nombre | `float` | `m_value` | `12,5` → 12.5 |
| `int` | Number | Nombre entier | entier | entier exigé | `m_value` | `42` → 42.0 |
| `age` | Number | Entier, unité « ans » | 0 à 120 | 0 à 120, entier | `m_value` | `34` → 34.0 |
| `pct` | Number | Unité « % » | 0 à 100 | 0 à 100 | `m_value` | `45,5 %` → 45.5 |
| `money` | Number | Unité « FCFA » | ≥ 0 | ≥ 0, espaces et « FCFA » retirés | `m_value` | `15 000 FCFA` → 15000.0 |
| `yesno` | Number | ○ Oui ○ Non | — | oui/non/1/0/vrai/faux | `m_value` | `1` → 1.0 |
| `choice` | Number | ○ boutons (≤ 7), sinon liste | code de la liste | code présent dans la liste | `m_value` | `2` → 2.0 |
| `scale` | Number | Réglette 1–5 | — | 1 à 5 | `m_value` | `4` → 4.0 |
| `multi` | Text | □ cases ; « Aucun » exclusif | — | codes connus, triés, dédoublonnés | `texte_element` (+ `valeur_json`) | `3;1;1` → `1;3` |
| `text` | Text | Texte court | — | espaces réduits, 255 max | `texte_element` | `  Mbarga   Paul ` → `Mbarga Paul` |
| `long` | Text | Zone de texte | — | 2 000 max | `texte_element` | — |
| `time` | Text | Heure + « Maintenant » | `hh:mm` | `hh:mm`, heure ≤ 23 | `texte_element` | `8h30` → `08:30` |
| `gps` | Text | Bouton « Capturer la position » | lat ±90, lng ±180 | 6 décimales | `texte_element` (+ `valeur_json`) | `4.0511, 9.7679` → `4.051100,9.767900` |
| `tel` | Text | Clavier téléphone | 8 à 15 chiffres | `+237` ajouté aux numéros camerounais à 9 chiffres | `texte_element` | `677 12 34 56` → `+237677123456` |
| `email` | Text | Clavier e-mail | format | minuscules, format | `texte_element` | `Nom@Exemple.org` → `nom@exemple.org` |
| `date` | Date | Calendrier + « Aujourd'hui » | alerte si future | AAAA-MM-JJ, entre 1900 et aujourd'hui | `date_element` | `2026-10-15` |
| `file` | File | Fichier (PDF, image, Word, Excel) | envoi terminé | identifiant entier | `fichier_element` | `73` |
| `photo` | File | Appareil photo / galerie | envoi terminé | identifiant entier | `fichier_element` | `73` |

### 4.3 Comment le designer devine le type

1. S'il existe un type mémorisé pour cet élément (dernier choix) et compatible → ce type.
2. Sinon, une règle sur le **libellé** (dans la nature de l'élément) :

| Libellé contient | Type proposé |
|---|---|
| photo, image | `photo` |
| pièce jointe, scan, justificatif, document, fichier, PV signé, liste de présence | `file` |
| téléphone, tél, portable | `tel` |
| e-mail, courriel | `email` |
| GPS, coordonnées, position, latitude | `gps` |
| observation, commentaire, remarque, description | `long` |
| heure | `time` |
| date | `date` |
| taux, pourcentage, proportion, % | `pct` |
| âge | `age` |
| montant, coût, prix, budget, FCFA, dépense | `money` |
| commence par nombre, nb, effectif, total | `int` |
| commence par est-ce, y a-t-il, existe, disposez, avez | `yesno` |

3. Sinon, le type par défaut de la nature : Number → `num`, Text → `text`, Date → `date`, File → `file`.

### 4.4 Tous les attributs `data-op-*`

| Attribut | Posé sur | Effet à la saisie | Exemple |
|---|---|---|---|
| `data-op-type` | champ | Type (tableau ci-dessus) | `data-op-type="tel"` |
| `data-op-required` | champ | Obligatoire ; astérisque sur le libellé | `data-op-required="1"` |
| `data-op-min` / `data-op-max` | champ | Bornes **bloquantes** | `data-op-max="120"` |
| `data-op-soft-min` / `data-op-soft-max` | champ | Bornes **d'alerte** (justification proposée) | `data-op-soft-max="50"` |
| `data-op-int` | champ | Entier exigé | `data-op-int="1"` |
| `data-op-na` | champ | Ajoute la case « N/A » | `data-op-na="1"` |
| `data-op-sum` | champ | Champ calculé = somme des champs listés | `data-op-sum="D0elt1,D0elt2"` |
| `data-op-unit` | champ | Unité affichée après le champ | `data-op-unit="FCFA"` |
| `data-op-choices` | champ `multi` | Options `code=libellé` séparées par `;` | `1=Fuite;2=Eau trouble;9=Aucun` |
| `data-op-accept` | champ fichier | Formats proposés au sélecteur | `image/*` |
| `data-op-liste` | `select` | Garde la liste déroulante même avec peu d'options | `data-op-liste="1"` |
| `data-op-hidden-value` | champ | Valeur mise quand la question est masquée | `data-op-hidden-value="0"` |
| `data-op-label` | champ | Libellé à utiliser dans les messages | — |
| `data-op-show-if` | `tr`, `p`, `h3` | Question conditionnelle | `D0elt2 == 1`, `D0elt5 == 3 && D0elt1 > 0` |
| `<div class="op-rules" data-rules='[…]'>` | formulaire | Règles de cohérence | voir §6.6 |
| `<hr class="op-page">` | formulaire | Saut de page (étapes sur mobile) | — |
| `<div class="indicSelector" data-id="9">` | formulaire | Indicateur affiché et calculé | — |

**Important :** TinyMCE supprime tout attribut qui n'est pas déclaré dans `extended_valid_elements` (fichier `data_sets_design.html`). Tout nouvel attribut doit y être ajouté, sinon il disparaît à l'enregistrement du formulaire.

---

## 5. Le designer de formulaires

Fichiers : `data_sets_design.html` (page) + `static/op-designer-pro.js` (outils avancés).

### 5.1 Ce que voit l'utilisateur

- **À gauche** : la recherche, les onglets *Data Elements* / *Indicateurs*, la progression « Éléments placés 4 / 5 », la liste des éléments (étiquette de nature : Nombre, Texte, Date, Fichier ; pastille « Placé » ; bouton **×** pour retirer) et le bouton « Insérer les éléments non placés ».
- **Au centre** : l'éditeur TinyMCE (tableaux, texte) et la barre d'outils OperaPlus (propriétés du champ, cohérence, conditions, désagrégation, modèles, import XLSForm, aperçu mobile, versions, vérifier).
- **En haut** : l'état « Enregistré / Modifications non enregistrées » et le raccourci Ctrl + S.

### 5.2 Insérer un élément

1. Clic sur l'élément → `insertDE(id, nom)` (fonction d'origine, enveloppée).
2. `op-designer-pro.js` intercepte : type deviné (§4.3), champ construit par `buildField()`, placé par `adaptPlacement()` :
   - curseur dans une ligne de tableau → nouvelle ligne ajoutée au même tableau (`rowFrom`) ;
   - curseur dans un paragraphe → paragraphe cloné (`blockFrom`) ;
   - le style (classe, dimensions) est copié des champs déjà présents (`matchLook`).
3. Un message propose « Changer le type ». **Maj + clic** ouvre directement le sélecteur de types (seuls les types compatibles avec la nature sont actifs).

### 5.3 « Insérer les éléments non placés »

Construit un tableau « Élément / Valeur » avec tous les éléments absents du formulaire. S'il existe déjà un tableau adapté (`bestTable`), les lignes y sont ajoutées. Les indicateurs vont sous une ligne de titre `tr.op-ind-head`.

### 5.4 Retirer un élément ou un indicateur

Deux accès :
- le **×** à droite d'un élément placé, dans la colonne de gauche ;
- la **pastille « Retirer »** qui apparaît au-dessus du champ cliqué dans l'éditeur.

Ce que fait le retrait (`window.opRetirerElement(id)` / `window.opRetirerIndicateur(id)`), dans **une seule transaction d'annulation** :
1. supprime toutes les occurrences du champ `D0elt<id>` (ou de l'indicateur) ;
2. supprime la **ligne de tableau** si elle ne contient plus aucun champ ni indicateur (sauf les en-têtes) ; supprime le **tableau** s'il devient vide ; supprime le titre « Indicateurs » s'il n'en reste plus ;
3. pour un champ dans un paragraphe « Libellé : [champ] », supprime le paragraphe ;
4. nettoie les **règles de cohérence** citant le champ (`op-rules`), les **conditions** (`data-op-show-if`) et les **sommes** (`data-op-sum`) ;
5. affiche « « Ménages desservis » retiré du formulaire · 2 règle(s) ou condition(s) liée(s) retirée(s). » avec un bouton **Annuler**.

Un seul Ctrl + Z restaure tout. Rien n'est enregistré tant qu'on ne clique pas sur **Enregistrer**.

### 5.5 Contrôles automatiques

- Au chargement : les champs dont le type ne correspond pas à la nature sont corrigés (`autoFix`), avec un bandeau vert.
- « Vérifier » : liste des problèmes (type incompatible, champ sans règle, question importée non associée…).
- À l'enregistrement : avertissement s'il reste des éléments non placés.

### 5.6 Pièges connus

| Piège | Conséquence | Règle |
|---|---|---|
| `{{ dataset.m_formulaire|safe }}` dans la `<textarea>` de l'éditeur | Un champ « texte long » (`</textarea>`) ferme l'éditeur et casse la page | **Ne jamais** mettre `|safe` à cet endroit |
| `</script>` écrit dans un commentaire JavaScript | Le navigateur ferme la balise script | Ne jamais écrire cette chaîne dans un template |
| Attribut non déclaré dans `extended_valid_elements` | TinyMCE le supprime en silence | Déclarer chaque nouvel attribut |

---

## 6. Le moteur de saisie `op-form-runtime.js`

### 6.1 Démarrage

La page appelle, après avoir injecté le HTML du formulaire :

```js
inst = OperaForm.init(contenu, { fresh: true, draft: false, submit: false });
```

| Option | Signification |
|---|---|
| `fresh: true` | Détruit l'instance précédente (formulaire rechargé dans le même conteneur) |
| `draft: false` | La page gère elle-même le brouillon |
| `submit: false` | La page gère l'envoi (AJAX) ; le moteur ne bloque pas le `submit` |

À la construction, le moteur relève tous les champs `input/select/textarea[name^="D0elt"]` et exécute, dans l'ordre : `setupFields` → `setupTypes` → `setupNA` → `setupCalc` → `setupConditions` → `setupPages` → `setupGPS` (→ `setupDraft` si activé).

### 6.2 `setupFields` — règles de base

Pose `required`, `min`, `max`, `step` d'après les `data-op-*`, et ajoute l'astérisque sur le libellé des champs obligatoires.

### 6.3 `setupTypes` — rendu par type

- Unité affichée (`data-op-unit`).
- `tel`, `email` : clavier adapté (`inputmode`) et saisie automatique.
- **Listes à choix unique** (`select`, sauf `data-op-liste`) → `setupOptions(f, 'radio')`.
- **Choix multiples** (`multi`) → `setupOptions(f, 'checkbox')`.
- **Heure / date** → bouton « Maintenant » / « Aujourd'hui ».
- **Fichier / photo** → `setupFichier(f, type)`.
- **GPS** → bouton « Capturer la position » (précision affichée).

### 6.4 `setupOptions` — les cases à cocher

Principe : **le champ d'origine `D0elt` reste dans la page, caché, et porte la valeur.** Les cases ne sont qu'une façade. Ainsi, rien ne change pour l'enregistrement, le brouillon ou le récapitulatif.

- Choix unique : boutons radio ; jusqu'à 7 options (au-delà, la liste d'origine est gardée).
- Re-cliquer sur la réponse cochée l'**efface**, sauf si la question est obligatoire.
- Échelle : les codes 1 à 5 sont affichés au-dessus des libellés.
- Choix multiples : cases ; une option dont le libellé commence par *Aucun, Rien, Ne sait pas, NSP, Refus, Non concerné* est **exclusive** ; compteur « 2 réponses cochées ».
- Chaque changement met à jour le champ caché puis émet `input` et `change` : la progression, les conditions, les indicateurs et le brouillon réagissent comme pour une saisie clavier.
- N/A coché → cases désactivées.
- Si la navigation clavier de la page (Entrée, flèches) arrive sur le champ caché, le focus passe sur les cases.

### 6.5 `fieldIssues` — contrôle d'un champ

Ordre des contrôles : masqué / N/A / calculé → ignoré ; obligatoire vide → erreur ; puis selon le type (téléphone, e-mail, GPS, date future = alerte, envoi de fichier en cours = erreur) ; puis pour les nombres : nombre, entier, bornes strictes (erreur), bornes souples (alerte).

### 6.6 Règles de cohérence (`op-rules`)

Format, posé par le designer dans `<div class="op-rules" data-rules='…'>` :

```json
[
  {"type": "lte", "a": "D0elt2", "b": "D0elt1", "label": "Les cas confirmés ne peuvent pas dépasser les cas suspects", "level": "err"},
  {"type": "sum", "target": "D0elt10", "parts": ["D0elt11", "D0elt12"], "label": "Total = hommes + femmes", "level": "warn"}
]
```

| `type` | Signification |
|---|---|
| `lte` | a ≤ b |
| `gte` | a ≥ b |
| `eq` | a = b |
| `sum` | target = somme des parts |

`level` : `err` (bloquant) ou `warn` (à confirmer, justification proposée).

### 6.7 Questions conditionnelles

`data-op-show-if="D0elt2 == 1"` sur une ligne : la ligne n'apparaît que si la condition est vraie. Opérateurs `== != > < >= <=`, conditions combinées par `&&`. Pour un choix multiple, `==` signifie « contient ». Un titre `.op-section` entraîne tout ce qui le suit jusqu'au titre suivant.

Quand une question est masquée, son champ prend `data-op-hidden-value` (ou `0`), et l'ancienne valeur est gardée en mémoire puis restaurée si la question réapparaît.

### 6.8 Champs calculés, pages, brouillon

- `data-op-sum` : champ en lecture seule recalculé à chaque saisie.
- `<hr class="op-page">` : le formulaire est découpé en étapes avec « Précédent / Suivant » (utile sur téléphone).
- Brouillon local (`localStorage`) : disponible dans le moteur, **désactivé** sur la page de saisie, qui gère son propre brouillon en cas d'échec d'envoi.

### 6.9 API publique

| Fonction | Rôle |
|---|---|
| `OperaForm.init(el, opts)` | Démarrer (ou redémarrer) le moteur sur un conteneur |
| `OperaForm.boot()` | Démarrage automatique sur les formulaires de la page |
| `OperaForm.contexte` | Fonction fournie par la page → `{dataset, structure, periode}` (rattachement des pièces jointes) |
| `OperaForm.fichier(id)` | Informations connues d'une pièce jointe (nom, taille…) |
| `OperaForm.retenirFichier(info)` | Mémoriser une pièce jointe reçue au chargement |
| `inst.collect()` | `{errs, warns, first}` sans rien afficher |
| `inst.refresh()` | Resynchroniser cases, calculs, conditions après un remplissage par code |

---

## 7. La page de saisie `saisie_donnees.html`

### 7.1 Ce que voit l'agent

| Zone | Contenu |
|---|---|
| Bandeau | Modules OperaPlus, recherche (Ctrl + K), thème clair / sombre, compte |
| Colonne gauche | Arborescence des unités, recherche, cases d'état (complet / partiel / vide) |
| § 01 Fiche | En-tête de l'organisation (logos), unité, période, numéro de fiche (`156-3-11`), étapes, cadran de complétude, tampon d'enregistrement |
| § 02 Sélection | Année, période, unité, « « » » unité précédente / suivante, **Charger les données** |
| § 03 Résultats | Indicateurs calculés en direct (carrousel) |
| § 04 Relevé | Le formulaire : filtre, Compact, Focus, Fiche (impression), progression |
| Dock | État, raccourcis clavier, % complété, **Enregistrer les données** |

### 7.2 Séquence de chargement

1. Clic sur **Charger les données** → `loadDataset()` récupère le HTML (`/get_dataset/<id>/`) et l'injecte dans `.card-body<ID> .contenu`.
2. `initIndic()` demande les formules des indicateurs (`/get_elements/`, `other=dI_formula`).
   - Le **préfiltre jQuery** (§16.5) intercepte la réponse : les formules contenant `#id#` sont développées et les éléments manquants repris d'autres formulaires.
   - `check_selector()` calcule les indicateurs à chaque saisie.
3. `opFetchValeurs()` interroge `/saisie-plus/api/valeurs/...` (repli : `/load_data/...` si `saisie_plus` répond 404).
4. `handleData(data)` (fonction d'origine) remplit les nombres, dates et zones de texte.
5. L'**enveloppe** de `handleData` :
   - `remplirAutresTypes()` : textes courts, téléphone, e-mail, heure, GPS, listes, choix multiples, fichiers (`it.fichier`, ou identifiant repris de `texte` pour les anciennes saisies), N/A recochés ;
   - démarre ou rafraîchit le moteur ;
   - prend l'**instantané** `base` (valeurs au chargement, pour le récapitulatif) ;
   - **marque** les champs ayant une valeur en base (`data-op-charge="1"`), pour savoir plus tard qu'un champ a été vidé ;
   - charge la période précédente, les justifications, la traçabilité, l'en-tête.

### 7.3 Séquence d'enregistrement

1. Clic sur **Enregistrer** (ou Ctrl + S).
2. Garde-fous : formulaire chargé ? unité et période inchangées depuis le chargement ?
3. Erreurs (moteur + règles) → liste « 2 points à corriger », focus sur le premier.
4. Alertes : valeurs hors bornes souples, **variation de plus de 60 %** avec la période précédente (et écart d'au moins 5) → liste avec une zone « Justification (recommandée) » par valeur.
5. **Récapitulatif** : nouvelles, modifiées, vidées ; tableau avant / après (fichiers affichés par leur nom) ; indicateurs ; rappel de l'unité et de la période.
6. `opSaveAjax()` :
   - `opBuildElements()` construit `elementsArea` : chaque champ rempli **et** chaque champ vidé qui avait une valeur en base (envoyé avec `value: ""`) ;
   - envoi `POST` en AJAX (`X-Requested-With: XMLHttpRequest`) ;
   - succès → statut « Enregistré à hh:mm », reçu dans `window.opDernierRecu`, tampon, message (orange et durable s'il y a des valeurs ignorées), remise à jour des marques « chargé », pastilles de complétude, proposition « Passer à l'unité suivante » ;
   - échec → message clair, saisies conservées en brouillon sur l'appareil.
7. Envoi des justifications (`/saisie-plus/api/justifications/`) et du journal (`/saisie-plus/api/journal/`).

### 7.4 Fonctions ajoutées les plus importantes

| Fonction | Où | Rôle |
|---|---|---|
| `opFetchValeurs(u, p, repli)` | script global | Valeurs de tous types, repli sur `/load_data/` |
| `opTypeSpec(f)` | pont | Type envoyé au serveur, avec la liste des codes pour les choix (`choice:1=Forage;2=Puits`) |
| `opBuildElements()` | pont | Construit `elementsArea` (remplis + vidés) |
| `opSaveAjax()` | pont | Enregistrement AJAX complet |
| `remplirAutresTypes(data)` | enveloppe | Remplit tous les types non numériques |
| `marquerCharges()` / `window.opMarquerCharges()` | enveloppe | Marque les champs chargés |
| `changements()` | enveloppe | Différences pour le récapitulatif |
| `rendreResultats()` | enveloppe | Résultats calculés |
| `construireFiche()` | enveloppe | Fiche imprimable |
| `opUpdateGauge()` / `opSetStatus()` | historique | Jauge et statut (lus par le cadran et le tampon, jamais modifiées) |

### 7.5 Clavier

| Touche | Effet |
|---|---|
| Entrée / Maj + Entrée | Champ suivant / précédent (jamais d'envoi accidentel) |
| Flèches | Déplacement dans la grille du relevé (gauche / droite seulement au bord du texte) |
| Ctrl + S | Enregistrer |
| Ctrl + K | Recherche |
| Ctrl + V | Collage depuis Excel dans la grille |

---

## 8. La normalisation des valeurs (`valeurs.py`)

Fichier : `ctn_bpf/valeurs.py` (code complet en annexe **A1**).

Signature : `normaliser(nature, type_champ, brut, na=False) -> dict` ; lève `ValeurInvalide("message lisible")`.

### 8.1 Règles, dans l'ordre

1. `na=True` → `{m_value: None, texte_element: None, date_element: None, fichier_element_id: None, est_na: True}`. **Jamais 0.**
2. Nature `File` **ou** type `file` / `photo` → `{fichier_element_id: int}` (vide ou `0` → `None`). Le type l'emporte : une pièce jointe ne finit jamais dans `texte_element`, même si la nature a été oubliée.
3. Nature `Date` → `date_element` (format `AAAA-MM-JJ`, entre 1900 et aujourd'hui).
4. Nature `Text` → `texte_element`, traité selon le type (`tel`, `email`, `gps`, `time`, `multi`, `long`, `text`).
5. Nature `Number` → `m_value`, selon le type (`yesno`, `choice`, `scale`, `int`, `age`, `pct`, `money`, `num`).

### 8.2 Exemples d'entrées et de sorties

| Appel | Résultat |
|---|---|
| `normaliser('Number', 'num', '12,5')` | `{'m_value': 12.5, 'est_na': False}` |
| `normaliser('Number', 'money', '15 000 FCFA')` | `{'m_value': 15000.0, …}` |
| `normaliser('Number', 'age', '150')` | `ValeurInvalide('âge hors limites (0 à 120)')` |
| `normaliser('Number', 'yesno', 'oui')` | `{'m_value': 1.0, …}` |
| `normaliser('Number', 'choice:1=Femme;2=Homme', '3')` | `ValeurInvalide('code « 3 » absent de la liste')` |
| `normaliser('Text', 'tel', '677 12 34 56')` | `{'texte_element': '+237677123456', …}` |
| `normaliser('Text', 'multi:1=a;2=b;3=c', '3;1;1')` | `{'texte_element': '1;3', 'valeur_json': ['1', '3'], …}` |
| `normaliser('Text', 'time', '8h30')` | `{'texte_element': '08:30', …}` |
| `normaliser('Date', 'date', '15/01/2026')` | `ValeurInvalide('date attendue au format AAAA-MM-JJ')` |
| `normaliser('Text', 'photo', '12')` | `{'fichier_element_id': 12, …}` |
| `normaliser('Number', 'int', '', na=True)` | toutes colonnes vides, `est_na: True` |

Le serveur re-contrôle **toujours**, même si la page a déjà contrôlé : une page ancienne, modifiée ou contournée ne peut pas écrire une valeur invalide.

---

## 9. L'enregistrement (`save_value`)

Fichier de référence : `serveur/save_value.py` (code complet en annexe **A2**), à coller dans `ctn_bpf/views.py` à la place de la fonction d'origine.

### 9.1 Ce que reçoit la vue (POST)

| Paramètre | Contenu |
|---|---|
| `dSv_id` | id du formulaire (`DataSet`) |
| `period1_saisie` | année |
| `period2_saisie` | id de la période (`PeriodeOk`) |
| `struc_selec` | id de l'unité |
| `elementsArea` | JSON `[{id, value, type}]` |
| `indicator-ids`, `indicator-values` | indicateurs calculés par la page |
| `op_na_D0elt<ID>` | `1` si « N/A » est coché |

### 9.2 Déroulement détaillé

```
1. Vérifications : unité et période présentes          → sinon erreur 400 « Choisissez l'unité et la période »
2. Transaction atomique (tout ou rien) :
   a. DataSetValue créé (trace de l'envoi)
   b. Reçu initialisé
   c. Indicateurs → IndicateurValeur.update_or_create (+1 « indicateurs » dans le reçu)
   d. Lignes existantes chargées en UNE requête (existants)
   e. Pour chaque élément de elementsArea :
        - élément inconnu                                → reçu.ignorees
        - normaliser()                                   → erreur ? on la note et on continue
        - pièce jointe : appartient-elle à l'agent ?      → sinon erreur
        - colonne fichier_element absente ?              → identifiant rangé dans texte_element + avertissement
        - colonnes absentes de la base                   → reçu.ignorees (« colonne … absente »)
        - valeur vide : ligne existante ? → effacement de toutes les colonnes ; sinon rien
        - comparaison avec l'existant : nouvelle / modifiée / inchangée / effacée
        - DSet_DElt.update_or_create(... comment__isnull=True, defaults={…, 'comment': None})
   f. Erreurs notées ? → exception → transaction annulée, message listant TOUTES les erreurs
   g. Calculs analytiques Celery programmés APRÈS validation (on_commit), pour les nombres
3. Réponse : {ok, message, recu} (AJAX) ou message Django + redirection (envoi classique)
```

### 9.3 Pourquoi « tout ou rien » ?

Si une valeur est invalide (ex. téléphone à 4 chiffres), **rien** n'est enregistré et l'agent reçoit la liste complète des corrections. Sinon, une fiche serait à moitié enregistrée sans que personne ne sache laquelle moitié.

### 9.4 Pourquoi les calculs Celery après `on_commit` ?

Si la tâche partait avant la fin de la transaction, elle pourrait lire les anciennes valeurs (ou des valeurs annulées). `on_commit` garantit qu'elle ne part que si l'écriture a réellement eu lieu.

### 9.5 Réponses possibles

| Situation | Code HTTP | Corps |
|---|---|---|
| Succès | 200 | `{"ok": true, "message": "…", "recu": {…}}` |
| Erreur de saisie | 400 | `{"ok": false, "error": "Téléphone : numéro de téléphone invalide ; Âge : …"}` |
| Erreur technique | 500 | `{"ok": false, "error": "Erreur du serveur pendant l'enregistrement…"}` (détail uniquement dans les logs) |

---

## 10. Le rechargement (`load_data` et API valeurs)

Deux adresses, même format de réponse :

| Adresse | Où | Utilisée |
|---|---|---|
| `/saisie-plus/api/valeurs/<structure>/<periode>/?dataset=<id>` | `saisie_plus/views.py` | En premier |
| `/load_data/<structure>/<periode>/` | `ctn_bpf/views.py` | En repli (si `saisie_plus` absente) |

### 10.1 Format

```json
{"data": [{"id": 12, "content": 42, "texte": null, "date": "2026-10-15", "na": false, "fichier": null}]}
```

| Clé | Contenu |
|---|---|
| `id` | Élément de données |
| `content` | `m_value` (12.0 renvoyé comme 12) |
| `texte` | `texte_element` |
| `date` | `date_element` au format ISO |
| `na` | `est_na` |
| `fichier` | `{id, nom, taille, type, url, apercu}` ou `null` |

### 10.2 Quelle ligne est renvoyée ?

Une seule par élément : la **saisie manuelle** (commentaire vide) passe avant le cumul automatique, puis la ligne **la plus récente**. Avec la contrainte d'unicité, il n'y a plus qu'une saisie manuelle par élément.

### 10.3 Filtre par formulaire

Avec `?dataset=158`, seuls les éléments de ce formulaire sont renvoyés. **Sans** ce paramètre, tous les éléments de l'unité et de la période sont renvoyés : c'est ce qu'utilisent les indicateurs composites pour reprendre des valeurs d'autres formulaires.

### 10.4 Version de référence de `load_data`

```python
def load_data(request, structure_id, periode_id):
    try:
        champs = {f.name for f in DSet_DElt._meta.get_fields()}
        lignes = (DSet_DElt.objects
                  .filter(periode_id=periode_id, m_structure_id=structure_id, m_dataelement__isnull=False)
                  .order_by('m_dataelement_id', '-id'))
        if 'fichier_element' in champs:
            lignes = lignes.select_related('fichier_element')
        retenues = {}
        for x in lignes:
            manuelle = not (x.comment or '').strip()
            deja = retenues.get(x.m_dataelement_id)
            if deja is None or (manuelle and not deja[1]):
                retenues[x.m_dataelement_id] = (x, manuelle)
        try:
            from saisie_plus.views import info_piece, peut_voir_piece
        except ImportError:
            info_piece = peut_voir_piece = None
        data_elements = []
        for x, _ in retenues.values():
            v = x.m_value
            if isinstance(v, float) and v.is_integer():
                v = int(v)
            d = getattr(x, 'date_element', None)
            piece = getattr(x, 'fichier_element', None) if 'fichier_element' in champs else None
            data_elements.append({
                'id': x.m_dataelement_id, 'content': v,
                'texte': getattr(x, 'texte_element', None),
                'date': d.isoformat() if d else None,
                'na': bool(getattr(x, 'est_na', False)),
                'fichier': (info_piece(piece) if piece and info_piece and peut_voir_piece(request.user, piece) else None),
            })
        return JsonResponse({'data': data_elements, 'message': 'Data loaded successfully'}, status=200)
    except Exception:
        logger.exception("Erreur load_data")
        return JsonResponse({'error': 'Chargement impossible.'}, status=500)
```

---

## 11. L'application `saisie_plus`

### 11.1 Pourquoi une application séparée ?

Pour ne pas toucher `ctn_bpf/views.py` (fichier très long, risqué à modifier) : chaque nouveauté serveur y vit, avec ses propres modèles, migrations, vues, URL, commandes et tests. Elle se monte en une ligne :

```python
# settings.py
INSTALLED_APPS += ['saisie_plus']
# urls.py principal
path('saisie-plus/', include('saisie_plus.urls')),
```

### 11.2 Contenu

```
saisie_plus/
├── models.py              JournalSaisie, Justification, EnTete, PieceJointe
├── migrations/            0001_initial, 0002_entete, 0003_piecejointe
├── views.py               API JSON + page d'en-tête + pièces jointes + formules
├── urls.py
├── formules.py            moteur des indicateurs composites
├── admin.py
├── templates/saisie_plus/en_tete.html
├── management/commands/dedoublonner_saisies.py
└── tests/test_formules.py
```

### 11.3 Toutes les adresses

| Méthode | Adresse | Paramètres | Réponse |
|---|---|---|---|
| GET | `api/valeurs/<structure>/<periode>/` | `dataset` (facultatif) | `{data: [...]}` (§10) |
| GET | `api/completude/<dataset>/<periode>/` | — | `{ok, total, resultats: {structure: {remplis, total}}}` |
| GET | `api/journal/` | `dataset, structure, periode` | `{ok, total, last: {user, date, nb_valeurs, nb_modifiees}}` |
| POST | `api/journal/` | JSON `{dataset, structure, periode, nb_valeurs, nb_modifiees}` | `{ok}` |
| GET | `api/justifications/` | `dataset, structure, periode` | `{ok, items: [{element_id, texte, user…}]}` |
| POST | `api/justifications/` | JSON `{…, items: [{element_id, valeur, motif, texte}]}` (texte vide = suppression) | `{ok}` |
| GET | `api/en-tete/` | `institution, dataset` | `{ok, source, logo, logo_partenaire, lignes}` |
| GET/POST | `en-tete/` | `institution, dataset, retour` | Page de réglage (logos PNG/JPG/WebP ≤ 2 Mo, SVG refusé) |
| POST | `api/fichiers/` | multipart `fichier, type, element, dataset, structure, periode` | `201 {ok, fichier}` |
| GET | `api/fichiers/<id>/` | — | `{ok, fichier}` ou 404 |
| GET | `fichier/<id>/` | `apercu=1` (facultatif) | Le fichier (droits contrôlés) |
| GET | `api/indicateurs/` | `institution, exclure` | `{ok, indicateurs: [{id, nom, calcule}]}` |
| GET | `api/formules/verifier/` | `formule, indicateur` | `{ok, erreurs, developpee, elements}` |

Toutes exigent un utilisateur connecté. Les POST exigent le jeton CSRF (`X-CSRFToken`).

---

## 12. Pièces jointes : fichiers et photos

### 12.1 Parcours

```
Agent choisit / prend la photo
   │  (photo > 1,2 Mo : réduite à 1600 px, JPEG qualité 0,82)
   ▼
POST /saisie-plus/api/fichiers/   (barre de progression)
   │  contrôles : extension + contenu réel + taille + type photo
   │  doublon (même auteur, même SHA-256) → pièce existante réutilisée
   ▼
PieceJointe enregistrée (stockage privé, nom aléatoire)  → {id: 73, nom, taille, url, apercu}
   ▼
Champ caché D0elt18 = "73"  → affichage : miniature, nom, taille, Ouvrir / Retirer
   ▼
Enregistrer → save_value : pièce 73 autorisée ? → DSet_DElt.fichier_element = 73
```

### 12.2 Contrôles de sécurité

| Contrôle | Détail |
|---|---|
| Extension | `.pdf .png .jpg .jpeg .webp .docx .xlsx` |
| Contenu réel | Début du fichier : `%PDF`, `\x89PNG`, `\xff\xd8\xff` (JPEG), `RIFF…WEBP`, `PK\x03\x04` (Word/Excel) |
| Taille | 10 Mo maximum |
| Photo | Images uniquement |
| SVG | Refusé (peut contenir du script) |
| Nom de stockage | `pieces/AAAA/MM/<uuid>.<ext>` : jamais le nom d'origine |
| Emplacement | `PRIVATE_MEDIA_ROOT`, **hors** de `MEDIA_ROOT` : nginx ne le sert jamais |
| Lecture | Seulement par `/saisie-plus/fichier/<id>/`, après `peut_voir_piece(user, piece)` |
| Réponse | Images affichées, autres formats **téléchargés** ; en-têtes `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'` |
| Rattachement | `save_value` refuse une pièce qui n'appartient pas à l'agent |

### 12.3 Droits

Par défaut : l'auteur de la pièce et le staff. Pour élargir (superviseur d'une unité…) :

```python
# settings.py
SAISIE_PLUS_PEUT_VOIR = 'ctn_bpf.droits.peut_voir_piece'

# ctn_bpf/droits.py
def peut_voir_piece(user, piece):
    return <règle : par ex. user gère piece.structure_id>
```

### 12.4 Affichage selon l'appareil

| Appareil | Boutons |
|---|---|
| Téléphone / tablette (écran tactile) | **Appareil photo** (capture directe) + **Galerie** (ou « Choisir un fichier ») |
| Ordinateur | **Choisir une photo / un fichier** ; glisser-déposer dans la case |
| Après envoi | Miniature (image) ou icône (PDF…), nom, taille, **Reprendre / Autre…**, **Ouvrir**, **Retirer** |

### 12.5 Configuration

```python
PRIVATE_MEDIA_ROOT = os.getenv('PRIVATE_MEDIA_ROOT', os.path.join(BASE_DIR, 'prive'))
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
```

```yaml
# docker-compose.yml, service web uniquement (pas nginx)
    volumes:
      - opera_prive_volume:/app/prive
volumes:
  opera_prive_volume:
```

nginx : `client_max_body_size 12M;`.

### 12.6 Cas particulier : colonne `fichier_element` absente

Si `DSet_DElt` n'a pas encore la colonne `fichier_element`, `save_value` range l'identifiant dans `texte_element` et ajoute un avertissement au reçu. La page sait relire un identifiant numérique depuis `texte` pour un champ fichier. Une fois la colonne ajoutée et migrée, les nouvelles pièces vont dans `fichier_element`.

---

## 13. Anti-doublons

### 13.1 D'où viennent les doublons

`save_value` retrouve la ligne à mettre à jour avec `comment__isnull=True`. Si une ligne manuelle a `comment = ''`, elle n'est pas retrouvée : une nouvelle ligne est créée à chaque enregistrement. Deux agents qui enregistrent en même temps peuvent aussi créer deux lignes.

### 13.2 Les trois protections

| Protection | Où | Effet |
|---|---|---|
| Nettoyage | Commande `dedoublonner_saisies` | Supprime les doublons existants en gardant la bonne valeur |
| Contrainte | Base de données (`UniqueConstraint` partielle) | Interdit tout nouveau doublon, même en cas de bug ou d'envois simultanés |
| Source | `save_value` | Écrit toujours `comment = None` |

### 13.3 La commande

```bash
python manage.py dedoublonner_saisies                          # simulation : affiche, ne modifie rien
python manage.py dedoublonner_saisies --appliquer              # nettoie (CSV de sauvegarde d'abord)
python manage.py dedoublonner_saisies --appliquer --auto       # + cumuls automatiques strictement identiques
python manage.py dedoublonner_saisies --appliquer --sauvegarde /chemin/doublons.csv
```

Exemple de sortie :

```
Saisies manuelles avec commentaire vide au lieu de NULL : 1
Groupes de saisies manuelles en double : 2  ·  lignes à supprimer : 3
  élément 1 · unité 1 · période 1 : 3 lignes → on garde #2, on retire #1, #3
  élément 2 · unité 1 · période 1 : 2 lignes → on garde #6, on retire #7
```

**Quelle ligne est gardée ?** La plus récente (date de saisie, les dates vides en dernier, puis id) **qui porte une valeur** (nombre, texte, date, pièce jointe ou N/A). À défaut, la plus récente. Une saisie vide récente n'écrase donc jamais une vraie valeur plus ancienne.

### 13.4 Procédure complète

```bash
docker exec meal-app-db pg_dump -U <utilisateur> <base> > sauvegarde_avant_doublons.sql   # 1
docker exec meal-app-web python manage.py dedoublonner_saisies                             # 2 (lire !)
docker exec meal-app-web python manage.py dedoublonner_saisies --appliquer                 # 3
# 4. ajouter la contrainte dans DSet_DElt.Meta (§3.3)
docker exec meal-app-web python manage.py makemigrations ctn_bpf                           # 5
docker exec meal-app-web python manage.py migrate
docker cp meal-app-web:/app/sauvegardes ./sauvegardes                                      # 6 (récupérer le CSV)
```

Si `migrate` échoue (« could not create unique index ») : il reste des doublons → reprendre l'étape 3.

---

## 14. Reçu d'enregistrement

### 14.1 Objectif

Ne plus jamais afficher « enregistré avec succès » quand une valeur a été perdue. Le serveur compte ce qu'il a **réellement** écrit.

### 14.2 Contenu

```json
{
  "ecrites": 9, "nouvelles": 3, "modifiees": 4, "inchangees": 1, "effacees": 1,
  "na": 1, "pieces": 2, "indicateurs": 2,
  "ignorees": [{"id": "77", "nom": "Femmes enceintes", "raison": "colonne date_element absente de la base"}],
  "avertissements": ["Photo : pièce jointe rangée provisoirement en texte (colonne fichier_element à ajouter)"],
  "heure": "10:42"
}
```

| Compteur | Signification |
|---|---|
| `nouvelles` | Aucune saisie n'existait pour cet élément, cette unité et cette période |
| `modifiees` | Une saisie existait, avec une valeur différente |
| `inchangees` | Même valeur qu'avant |
| `effacees` | Champ vidé par l'agent, la valeur en base a été effacée |
| `na` | Valeurs « non applicable » |
| `pieces` | Pièces jointes rattachées |
| `indicateurs` | Valeurs d'indicateurs écrites dans `IndicateurValeur` |
| `ignorees` | Valeurs **non** écrites, avec la raison |
| `avertissements` | Écrites, mais d'une façon à corriger |

### 14.3 Ce que voit l'agent

- Message : « **9 valeurs enregistrées : 3 nouvelles, 4 modifiées, 1 effacée, 1 inchangée · 1 non applicable · 2 pièces jointes · 2 indicateurs · 1 ignorée** ».
- S'il y a des ignorées : titre orange « Enregistré, mais 1 valeur non enregistrée », la liste des valeurs et des raisons, message affiché 15 secondes.
- Tampon sur la fiche : « ENREGISTRÉ 10:42 · 9 valeurs · 1 ignorée », en vert ou en orange.

---

## 15. Effacement d'une valeur

### 15.1 Le problème d'origine

Pour ne pas envoyer des zéros partout, la page n'envoyait jamais les cases vides. Conséquence : retirer une photo ou effacer un nombre n'avait **aucun effet** en base.

### 15.2 La solution

1. Au chargement, chaque champ qui a une valeur en base (ou un N/A) est marqué `data-op-charge="1"`.
2. À l'envoi, un champ **vide et marqué** est envoyé avec `value: ""`.
3. `save_value` reçoit une valeur vide :
   - une ligne existe → **toutes** ses colonnes de valeur sont vidées (y compris un ancien identifiant de fichier rangé en texte) ; reçu : « effacée » ;
   - aucune ligne → rien n'est écrit (pas de ligne vide).
4. Après un enregistrement réussi, les marques sont recalculées.

Le récapitulatif l'annonce : « Photo du point d'eau · Avant : 📎 forage_akwa.jpg · Après : vide » et « 1 case vidée : l'ancienne valeur (ou pièce jointe) sera effacée ».

La pièce jointe elle-même reste dans `PieceJointe` : seul son lien avec la fiche est effacé.

---

## 16. Indicateurs et indicateurs composites

### 16.1 Les indicateurs classiques

- Formule écrite dans `creer_indicateur.html` avec des **éléments de données** : `$1$ / $2$ * 100`.
- Placés dans le formulaire par `<div class="indicSelector" data-id="9">`.
- À la saisie, `initIndic()` → `/get_elements/` renvoie `formulas` (une par indicateur affiché, dans l'ordre) et `data_elts` (`"1#2"`). `check_selector()` remplace chaque `$id$` par la valeur du champ `D0elt<id>` (0 si vide) puis calcule.
- À l'enregistrement : `indicator-ids` et `indicator-values` → `IndicateurValeur`.

### 16.2 Les indicateurs composites

Un indicateur calculé à partir d'autres indicateurs.

| Syntaxe | Sens |
|---|---|
| `$12$` | élément de données n° 12 |
| `#9#` | indicateur n° 9 |

Exemple : *Indice de qualité du service* = `( #9# + #10# ) / 2`.

### 16.3 Le principe : développer la formule

Avant tout calcul, chaque `#id#` est remplacé par la formule de l'indicateur, entre parenthèses, jusqu'à n'avoir plus que des `$id$` :

```
#11# = ( #9# + #10# ) / 2
#9#  = $1$ / $2$ * 100
#10# = $3$ / $4$ * 100
→ #11# développé = ( ($1$ / $2$ * 100) + ($3$ / $4$ * 100) ) / 2
```

**Pourquoi développer plutôt qu'utiliser la valeur déjà calculée de #9# ?**
1. Le reste d'OperaPlus (page de saisie, `IndicateurValeur`, calculs) reçoit une formule ordinaire : rien d'autre à modifier.
2. Le calcul repart **toujours des données brutes**. Au niveau d'un district, on additionne d'abord les éléments, puis on applique la formule. Exemple :

| | Cas confirmés | Cas suspects | Ménages desservis | Ménages total |
|---|---|---|---|---|
| Point A | 30 | 60 | 45 | 50 |
| Point B | 2 | 40 | 100 | 400 |
| **District** | **32** | **100** | **145** | **450** |

- Correct (développé, sur les sommes) : (32 % + 32,2 %) / 2 = **32,1**.
- Faux (moyenne des indices de chaque point) : (70 + 15,5) / 2 = **42,8**.

### 16.4 Le moteur `saisie_plus/formules.py`

Code complet en annexe **A3**.

| Fonction | Rôle | Exemple |
|---|---|---|
| `extraire(f)` | Éléments et indicateurs cités | `extraire('#9# + $7$')` → `([7], [9])` |
| `developper(f)` | Développement récursif | voir §16.3 |
| `verifier(f, indicateur_id)` | Liste d'erreurs | `['Boucle entre indicateurs : #9# → #11# → #9#.']` |
| `evaluer(f, valeurs)` | Calcul **sans `eval`** | `evaluer('($1$/$2$*100)', {1: 30, 2: 60})` → `50.0` |
| `dependances(f)` | Éléments nécessaires après développement | `[1, 2, 3, 4]` |

Erreurs détectées :
- indicateur inconnu ;
- indicateur **en saisie manuelle** (sans formule) : il n'a pas de formule à reprendre ;
- un indicateur qui se cite lui-même ;
- **boucle** (A → B → A), avec le chemin ;
- plus de 10 niveaux d'imbrication ;
- formule mal écrite (parenthèse, opérateur).

`evaluer` n'accepte que des nombres, des `$id$` et `+ - * / ( )` (et `**`) : aucun code ne peut s'exécuter, contrairement à `eval()`.

Le champ de formule du modèle `Indicateur` est détecté parmi `numerateur`, `m_numerateur`, `formule`, `m_formule`, `m_formula`, `formula`, ou fixé par :

```python
SAISIE_PLUS_CHAMP_FORMULE = 'numerateur'
```

### 16.5 À la création d'un indicateur (`creer_indicateur.html`)

- Le dictionnaire de données a deux onglets : **Éléments de données** (insère `$id$`) et **Indicateurs** (insère `#id#`). Les indicateurs en saisie manuelle sont grisés.
- La lecture de la formule affiche les noms en couleur : *(Taux de positivité + Taux d'accès à l'eau) ÷ 2*.
- La ligne **« Calcul réel, à partir des données brutes »** montre la formule développée avec les noms des éléments.
- Le serveur vérifie la formule à chaque frappe (`/saisie-plus/api/formules/verifier/`). En cas d'erreur, le bouton **Créer** est bloqué avec le message.

### 16.6 À la saisie

Un **préfiltre jQuery** intercepte la réponse de `/get_elements/` avant que `check_selector` ne l'utilise :

1. Chaque formule contenant `#id#` est envoyée à `/saisie-plus/api/formules/verifier/` → formule développée + éléments nécessaires.
2. `data.formulas` est remplacé par les formules développées, et `data_elts` complété.
3. Pour chaque élément nécessaire **absent du formulaire** :
   - sa valeur est cherchée dans les autres formulaires de **la même unité et la même période** (`/saisie-plus/api/valeurs/...` sans filtre de formulaire) ;
   - si elle existe, elle est placée dans un champ caché `D0elt<id>` **hors du relevé** (`#op-hors-formulaire`) : elle sert au calcul, mais n'est **jamais** renvoyée à l'enregistrement ;
   - sinon, l'élément compte pour 0, et un message le dit.
4. `check_selector` calcule comme pour n'importe quel indicateur.

Conséquences pratiques :
- l'indicateur cité (#9#) **n'a pas besoin** d'être affiché dans le formulaire ;
- ses éléments de données doivent être dans le formulaire, **ou** déjà saisis ailleurs pour la même unité et la même période.

Messages possibles :

| Message | Signification |
|---|---|
| « Valeurs reprises d'autres formulaires … (n° 77) » | Le calcul utilise une valeur saisie ailleurs |
| « Indicateur composite incomplet … (n° 78) : ils comptent pour 0 » | Aucune valeur nulle part pour cet élément |
| « Indicateur composite non calculable : Boucle … » | Erreur de formule |

### 16.7 Où s'enregistre un composite

Dans `IndicateurValeur`, comme tout indicateur, **s'il est placé** dans le formulaire. Les indicateurs qu'il cite n'y vont que s'ils sont aussi placés.

### 16.8 Branchements serveur conseillés (dans `ctn_bpf/views.py`)

```python
from saisie_plus.formules import developper, verifier, evaluer, dependances, FormuleInvalide

# 1. Enregistrement d'un indicateur : refuser une formule incorrecte
erreurs = verifier(request.POST.get('numerateur', ''), indicateur_id=indicateur.id if indicateur else None)
if erreurs:
    messages.error(request, 'Formule refusée : ' + erreurs[0])
    return redirect(request.META.get('HTTP_REFERER', '/'))

# 2. /get_elements/ (facultatif : la page le fait déjà) :
formulas = [developper(f) if f else f for f in formulas]
ids = set()
for f in formulas:
    if f:
        ids.update(dependances(f))
data_elts = '#'.join(str(i) for i in sorted(ids))

# 3. Calcul analytique (Celery) : remplacer eval()
try:
    valeur = evaluer(developper(formule), valeurs_agregees_par_element)   # {id_element: somme sur la zone}
except ZeroDivisionError:
    valeur = None   # « non calculable », jamais 0
```

---

## 17. Le design de la page de saisie

### 17.1 Les couches

Toutes dans `<head>`, dans cet ordre ; chacune peut être supprimée sans casser la page.

| Bloc | Rôle | Ce qui disparaît si on le supprime |
|---|---|---|
| Styles d'origine + « Registre de terrain » | Tokens `--op-*`, mise en page de base | La mise en forme OperaPlus |
| `<style id="op-registre">` | Carnet de relevé : sections §, numéros de ligne, cadran, cases ○/□, relevé empilé sur téléphone | La structure « registre » |
| `<style id="op-vivant">` | Couleurs : Fiche sarcelle, Sélection indigo, Résultats corail, Relevé safran ; cadran à 3 zones ; résultats colorés | Les couleurs vives |
| `<style id="op-douceur">` | Coins arrondis, ombres légères, transitions lentes, moins de capitales | La douceur |

Script de fin de page (après le contenu) : cadran, carrousel des résultats, numéro de fiche, tampon, marque-page dans l'arborescence, dessin de la page vierge. Il lit l'état de la page (`#op-gauge-pct`, `#op-save-status`, `#structureSelect`) par `MutationObserver` : `opUpdateGauge` et `opSetStatus` restent inchangées.

### 17.2 Pourquoi `html body` devant chaque règle ajoutée

Des blocs `<style>` historiques sont placés **dans le `<body>`**, donc lus après le `<head>`. À spécificité égale, le dernier lu gagne. Préfixer par `html body` rend nos règles plus spécifiques : elles gagnent quel que soit l'ordre.

### 17.3 Pourquoi les styles sont dans `<head>`

Placés en fin de page, ils n'étaient appliqués qu'après l'affichage du reste : l'ancien design apparaissait une fraction de seconde. Dans `<head>`, ils s'appliquent dès le premier affichage.

### 17.4 Le code couleur

| Couleur | Variable | Sens |
|---|---|---|
| Sarcelle | `--v-teal` | Fiche, champ rempli, réponse cochée |
| Indigo | `--v-indigo` | Sélection, justifications, période précédente |
| Corail | `--v-coral` | Résultats, unité en cours, lignes calculées, zone 0–40 % |
| Safran | `--v-saffron` | Relevé, champ en cours, action à faire, zone 40–80 % |
| Vert | `--op-ok` | Complet, enregistré, zone 80–100 % |
| Rouge | `--op-err` | Erreur |

Chaque couleur a une version claire (`*-soft`) et une version pour le mode sombre.

### 17.5 Le cadran

40 graduations sur un demi-cercle, trois zones (0–40 % corail, 40–80 % safran, 80–100 % vert), aiguille, lecture « 75 % · 3 / 4 champs » et étiquette « À remplir / En cours / Complet ». Il se met à jour quand `opUpdateGauge` change le texte de `#op-gauge-pct`.

### 17.6 Le carrousel des résultats

Une seule bande, quel que soit le nombre d'indicateurs : position « 1–5 / 14 », boutons ‹ ›, « Tout voir » (grille limitée à environ trois rangées), flèches du clavier, glisser sur téléphone. Quand **une seule** valeur change après une saisie, sa carte est ramenée dans la bande et marquée.

### 17.7 Sur téléphone

- La fiche passe sur une colonne, le cadran en bas.
- Un tableau à deux colonnes « Élément / Valeur » devient une suite de lignes : libellé en haut, réponse en pleine largeur dessous, numéro à gauche. Les grilles de trois colonnes ou plus gardent le défilement horizontal.
- Les choix passent sur deux colonnes, l'échelle 1–5 tient sur une ligne.

### 17.8 Polices

| Police | Usage |
|---|---|
| Fraunces | Titres, grands chiffres (cadran, résultats) |
| Plus Jakarta Sans | Interface, libellés |
| IBM Plex Mono | Nombres saisis, numéro de fiche |

---

## 18. Installation et déploiement

### 18.1 Fichiers à copier

| Fichier livré | Destination |
|---|---|
| `op-form-runtime.js`, `op-designer-pro.js` | `ctn_bpf/static/` |
| `saisie_donnees.html`, `data_sets_design.html`, `dataelts.html`, `creer_indicateur.html` | `webpages/templates/webpages/ctn_bpf/` |
| `saisie_plus/` (dossier entier) | racine du projet |
| `valeurs.py`, `test_valeurs.py` | `ctn_bpf/` |
| `save_value.py` | remplace la fonction `save_value` dans `ctn_bpf/views.py` |
| `load_data` (§10.4) | remplace la fonction dans `ctn_bpf/views.py` |

Imports nécessaires en haut de `ctn_bpf/views.py` :

```python
import json, logging
from django.http import JsonResponse
from django.db import transaction as db_transaction
from .valeurs import normaliser, ValeurInvalide
logger = logging.getLogger(__name__)
```

### 18.2 Modifications des modèles (`ctn_bpf/models.py`)

```python
# DataElement.m_value_type : ajouter le choix
("File", "Fichier"),

# DSet_DElt
fichier_element = models.ForeignKey('saisie_plus.PieceJointe', null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='+')
comment = models.TextField(blank=True, null=True)      # null=True obligatoire
# + la contrainte d'unicité (§3.3), APRÈS le dédoublonnage
```

### 18.3 Réglages (`settings.py`)

```python
INSTALLED_APPS += ['saisie_plus']
PRIVATE_MEDIA_ROOT = os.getenv('PRIVATE_MEDIA_ROOT', os.path.join(BASE_DIR, 'prive'))
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
STATIC_ROOT = os.getenv('STATIC_ROOT', '/app/static/')
MEDIA_ROOT = os.getenv('MEDIA_ROOT', '/app/media/')
# facultatif
# SAISIE_PLUS_CHAMP_FORMULE = 'numerateur'
# SAISIE_PLUS_PEUT_VOIR = 'ctn_bpf.droits.peut_voir_piece'
```

En local, **ne pas** définir `STATIC_ROOT` / `MEDIA_ROOT` à `/app/...` dans le `.env` (erreur `PermissionError: '/app'`).

### 18.4 Docker

- Les volumes nommés sont préfixés par le nom du projet compose. Les statiques et médias partagés avec nginx sont déclarés `external: true` : `opera_static_volume`, `opera_media_volume`.
- Base de données : `plateformeoperaplus_db_data` (vérifier avec `docker inspect meal-app-db`).
- Pièces jointes : `opera_prive_volume`, monté **uniquement** dans le service web.
- nginx : `location /static/` et `/media/` sur les volumes partagés ; `client_max_body_size 12M;`.

### 18.5 Ordre des commandes

```bash
cd /home/PlateformeOperaPlus
git pull
docker exec meal-app-db pg_dump -U <utilisateur> <base> > sauvegarde_$(date +%Y%m%d).sql
docker exec meal-app-web python manage.py makemigrations ctn_bpf
docker exec meal-app-web python manage.py migrate
docker exec meal-app-web python manage.py dedoublonner_saisies            # simulation
docker exec meal-app-web python manage.py dedoublonner_saisies --appliquer
# ajouter la contrainte, puis :
docker exec meal-app-web python manage.py makemigrations ctn_bpf
docker exec meal-app-web python manage.py migrate
docker exec meal-app-web python manage.py collectstatic --noinput
docker exec meal-app-web python manage.py test ctn_bpf saisie_plus.tests
docker restart meal-app-web            # WhiteNoise ne voit les nouveaux statiques qu'après redémarrage
```

### 18.6 Vérifier que tout est à jour sur le serveur

```bash
docker exec meal-app-web sh -c "grep -c _fichier_de saisie_plus/views.py; grep -c retenirFichier /app/static/op-form-runtime.js; grep -c setupOptions /app/static/op-form-runtime.js; grep -rc 'op-douceur' webpages/templates/webpages/ctn_bpf/saisie_donnees.html"
```

Chaque nombre doit être supérieur ou égal à 1.

---

## 19. Tests et vérifications

### 19.1 Tests automatiques

```bash
python manage.py test ctn_bpf             # normalisation (test_valeurs.py) : nombres, textes, dates, fichiers
python manage.py test saisie_plus.tests   # formules : développement, calcul, boucles, sécurité
```

### 19.2 Vérification manuelle conseillée après chaque déploiement

| N° | Action | Résultat attendu |
|---|---|---|
| 1 | Ouvrir une fiche, charger les données | Valeurs, choix, heures, fichiers et N/A réapparaissent |
| 2 | Modifier un nombre, enregistrer | Reçu « 1 modifiée » |
| 3 | Joindre une photo, enregistrer, recharger | Miniature affichée |
| 4 | Retirer la photo, enregistrer, recharger | Champ vide ; reçu « 1 effacée » |
| 5 | Saisir un téléphone invalide | Erreur, rien n'est enregistré |
| 6 | Saisir une valeur très différente du mois précédent | Demande de justification |
| 7 | Indicateur composite | Calculé en direct ; message si un élément manque |
| 8 | Designer : retirer un champ lié à une règle | Règle nettoyée ; « Annuler » restaure |
| 9 | Téléphone | Relevé empilé, boutons Appareil photo / Galerie |
| 10 | Mode sombre | Lisible, aucune zone bleu marine |

### 19.3 Test manquant (à écrire)

Un test de bout en bout de `save_value` dans la CI : indicateurs + pièce jointe + N/A + effacement + élément inconnu, avec vérification du reçu. Il aurait détecté l'erreur `recu` du 5 novembre.

---

## 20. Dépannage détaillé

### 20.1 Tableau des pannes

| Symptôme | Cause | Vérification | Correction |
|---|---|---|---|
| 404 sur `/static/op-…js` alors que `findstatic` trouve le fichier | Volumes statiques différents entre web et nginx, ou pas de redémarrage | `docker volume ls`, `docker inspect` | Volumes `external` partagés, `collectstatic`, redémarrer |
| `ModuleNotFoundError: saisie_plus` | Dossier absent de la racine | `ls saisie_plus` | Dézipper à la racine, `INSTALLED_APPS` |
| `NameError: ValeurInvalide` | Import manquant | — | `from .valeurs import normaliser, ValeurInvalide` |
| `PermissionError: '/app'` en local | `.env` local avec chemins de production | `.env` lignes `STATIC_ROOT` / `MEDIA_ROOT` | Les retirer |
| `test_valeurs` ne s'importe pas en CI | Mauvais chemin d'import | — | `from ctn_bpf.valeurs import …` |
| Seuls les nombres se rechargent | Ancien `load_data` ou ancienne API | Console (§20.2) | Versions à jour |
| Photo enregistrée mais pas rechargée | Colonne `fichier_element` absente, ou nature « Texte » | Shell (§20.3) | Ajouter la colonne, migrer ; nature « Fichier » |
| Fichier retiré mais toujours là | Ancienne page / ancienne `save_value` | — | Versions à jour |
| `UnboundLocalError: recu` | `save_value` du 5/11 au matin | — | Dernière version |
| `migrate` : « could not create unique index » | Doublons restants | `dedoublonner_saisies` | `--appliquer` puis `migrate` |
| L'ancien design apparaît un instant | Tailwind par CDN, styles tardifs | — | Styles dans `<head>` (fait) ; compiler Tailwind |
| La jauge ne s'affiche pas | Cause exacte non identifiée (l'ancien anneau dépendait d'un calcul CSS fragile) | — | Le cadran `op-registre` le remplace, dessiné par script |
| « Indicateur composite non calculable » | Boucle, indicateur manuel, champ de formule non reconnu | `/saisie-plus/api/formules/verifier/?formule=…` | Corriger ; `SAISIE_PLUS_CHAMP_FORMULE` |
| « Indicateur composite incomplet » | Élément sans valeur pour l'unité et la période | — | Ajouter le champ ou saisir l'autre formulaire |
| Erreur 413 à l'envoi d'une photo | Limite nginx | — | `client_max_body_size 12M;` |
| Erreur 403 à l'envoi d'une photo | Session expirée ou CSRF | — | Se reconnecter |

### 20.2 Diagnostic dans le navigateur

Page de saisie ouverte, unité et période choisies, F12 → Console :

```js
fetch('/saisie-plus/api/valeurs/' + document.getElementById('structureSelect').value + '/' + document.getElementById('period').value + '/?dataset=' + document.querySelector('[name=dSv_id]').value, {credentials: 'same-origin'})
  .then(r => r.json())
  .then(d => console.table(d.data.map(x => ({id: x.id, content: x.content, texte: x.texte, fichier: x.fichier ? x.fichier.nom : '—', cle_fichier: 'fichier' in x}))));
console.log('moteur à jour :', typeof OperaForm.retenirFichier === 'function', typeof OperaForm.init === 'function');
```

### 20.3 Diagnostic en base

```bash
docker exec -it meal-app-web python manage.py shell -c "
from ctn_bpf.models import DSet_DElt
for x in DSet_DElt.objects.order_by('-id')[:10]:
    print(x.id, x.m_dataelement_id, x.m_dataelement.m_value_type if x.m_dataelement else '-', 'unité', x.m_structure_id, 'période', x.periode_id,
          'val', x.m_value, 'texte', x.texte_element, 'fichier', getattr(x, 'fichier_element_id', '(pas de colonne)'), 'comment', repr(x.comment))"
```

---

## 21. Règles de développement

1. **Ne jamais renommer** un id, un `name`, une classe, une variable Django ou une fonction JS existants. On ajoute par-dessus : enveloppe de fonction (`const _f = window.f; window.f = function () { … _f.apply(this, arguments) … }`), nouveaux blocs `<style>` / `<script>`, attributs `data-*`.
2. **Ne pas modifier `ctn_bpf/views.py`** pour les nouveautés : tout passe par `saisie_plus`. Seules exceptions documentées : `save_value` et `load_data`.
3. **Une nature = une colonne.** Toujours normaliser côté serveur ; ne jamais faire confiance à la page.
4. **Aucune perte silencieuse** : ce qui n'est pas écrit apparaît dans le reçu.
5. **Tout ou rien** pour un enregistrement ; calculs dérivés après `on_commit`.
6. **Pas d'`eval`** côté serveur : utiliser `formules.evaluer`.
7. **Design** : couleurs codées (elles signifient quelque chose), pas d'effets gratuits (halos, dégradés décoratifs, flous).
8. **Secrets** uniquement dans `.env`, `.env` hors de git, jamais copié dans une conversation ou un ticket.
9. **Avant chaque déploiement** : `pg_dump`, tests, puis vérification manuelle (§19.2).

**Dette technique connue** : la règle n° 1 a protégé l'existant mais a empilé les couches (page de plus de 4 000 lignes, plusieurs blocs de styles qui se surchargent, Tailwind par CDN). Un nettoyage est prévu (§22).

---

## 22. Reste à faire

| Priorité | Chantier | Ce qu'il faut | Dépend de |
|---|---|---|---|
| 1 | Circuit de validation : Brouillon → Soumise → Validée / Rejetée, motif par ligne, verrouillage | Modèles dans `saisie_plus`, contrôle du verrou dans `save_value` | Relation utilisateur ↔ unités, règle « qui valide » |
| 2 | Droits par unité (saisie, consultation des photos) | `SAISIE_PLUS_PEUT_VOIR`, filtres | idem |
| 3 | Saisie hors ligne (PWA) : paquet hors ligne, file d'attente, envoi différé, identifiant unique par fiche | Service worker, IndexedDB, API « paquet » | Téléphones Android, durée sans réseau |
| 4 | Composites dans le calcul analytique | `evaluer(developper(...))` dans la tâche Celery | `trigger_analytics_calculation` |
| 5 | Test de bout en bout de `save_value` | Test Django | — |
| 6 | Nettoyage technique | Tailwind compilé ; styles et scripts ajoutés dans des fichiers statiques | — |
| 7 | Valeur « inconnue » ; « Autre (préciser) » | Nouvelle option + colonne ou convention | — |
| 8 | Reprise « mois → trimestre → année » | Correspondance des périodes | Modèle `PeriodeOk` |
| 9 | Recalcul de `IndicateurValeur` après changement de formule | Commande `recalculer_indicateurs` | — |
| 10 | Sauvegardes automatiques | Service Docker (base + volume privé) | — |
| 11 | Rotation des secrets | Nouvelles clés API, `SECRET_KEY`, `ALTER USER` Postgres | — |

---

## 23. Glossaire

| Terme | Définition |
|---|---|
| Élément de données (data element) | Une donnée à collecter (« Ménages desservis ») |
| Nature | Nombre, Texte, Date ou Fichier : décide de la colonne en base |
| Type de champ | Façon de saisir (téléphone, choix, photo…), posée par le designer |
| Formulaire (dataset) | Ensemble d'éléments et d'indicateurs, avec son HTML |
| Unité (structure) | Lieu concerné (point d'eau, école, district) |
| Période | Mois, trimestre ou année de la donnée |
| Fiche | Un formulaire pour une unité et une période |
| Saisie manuelle | Ligne `DSet_DElt` avec `comment = NULL` |
| Cumul automatique | Ligne calculée par le serveur, avec un commentaire |
| N/A | Non applicable : différent de 0 et différent de vide |
| Indicateur composite | Indicateur dont la formule cite d'autres indicateurs (`#id#`) |
| Développer | Remplacer chaque `#id#` par la formule de l'indicateur |
| Reçu | Compte exact de ce que le serveur a écrit |
| Pièce jointe | Fichier ou photo stocké dans `PieceJointe` |
| Normaliser | Contrôler et mettre une valeur au format de stockage |

---

## Annexes : code de référence

Les annexes reproduisent le code serveur tel qu'il a été livré. En cas de doute, c'est la version dans le dépôt qui fait foi.


### A1. `ctn_bpf/valeurs.py` — normalisation

```python
"""OperaPlus · normalisation des valeurs saisies avant l'enregistrement dans DSet_DElt.

Une nature (DataElement.m_value_type) = une colonne :
    Number -> m_value (FloatField)   Text -> texte_element   Date -> date_element
    File   -> fichier_element (pièce jointe saisie_plus.PieceJointe, envoyée avant l'enregistrement)
Le type précis (tel, gps, multi…) affine le contrôle et le format enregistré.
"""
import re
from datetime import date

OUI = {'1', 'oui', 'o', 'yes', 'y', 'true', 'vrai'}
NON = {'0', 'non', 'n', 'no', 'false', 'faux'}


class ValeurInvalide(ValueError):
    pass


def _codes(spec):
    """'choice:1=Femme;2=Homme' -> {'1', '2'} (vide si la liste n'est pas fournie)."""
    if ':' not in spec:
        return set()
    return {p.split('=')[0].strip() for p in spec.split(':', 1)[1].split(';') if '=' in p}


def _nombre(v):
    s = re.sub(r'[\s ]|fcfa|xaf|%', '', str(v), flags=re.I).replace(',', '.')
    try:
        return float(s)
    except ValueError:
        raise ValeurInvalide('nombre attendu')


def normaliser(nature, type_champ, brut, na=False):
    """Retourne le dict des champs à écrire dans DSet_DElt.
    Lève ValeurInvalide avec un message lisible par l'agent."""
    nature = (nature or 'Number').strip()
    spec = (type_champ or '').strip()
    t = spec.split(':', 1)[0].lower()
    v = '' if brut is None else str(brut).strip()
    vide = {'m_value': None, 'texte_element': None, 'date_element': None, 'fichier_element_id': None}

    if na:                                                     # « Non applicable » : jamais 0
        return dict(vide, est_na=True)

    # ---------------- Fichier ----------------
    # Un champ Fichier / Photo du designer va TOUJOURS dans fichier_element, même si la nature de
    # l'élément n'a pas été passée à « Fichier » dans Data elements (sinon l'identifiant finissait dans texte_element).
    if nature == 'File' or t in ('file', 'photo'):                                       # la valeur est l'identifiant de la pièce jointe
        if v in ('', '0'):
            return {'fichier_element_id': None, 'est_na': False}
        if not v.isdigit():
            raise ValeurInvalide('pièce jointe invalide : renvoyez le fichier')
        return {'fichier_element_id': int(v), 'est_na': False}

    # ---------------- Date ----------------
    if nature == 'Date':
        if not v:
            return {'date_element': None, 'est_na': False}
        try:
            d = date.fromisoformat(v[:10])
        except ValueError:
            raise ValeurInvalide('date attendue au format AAAA-MM-JJ')
        if d.year < 1900 or d > date.today():
            raise ValeurInvalide('date hors période plausible')
        return {'date_element': d, 'est_na': False}

    # ---------------- Texte ----------------
    if nature == 'Text':
        if not v:
            return {'texte_element': None, 'est_na': False}
        if t == 'tel':
            ch = re.sub(r'\D', '', v)
            if ch.startswith('00'):
                ch = ch[2:]
            if len(ch) == 9 and ch[0] in '62':                 # numéro camerounais sans indicatif
                ch = '237' + ch
            if not 8 <= len(ch) <= 15:
                raise ValeurInvalide('numéro de téléphone invalide')
            out = '+' + ch
        elif t == 'email':
            out = v.lower()
            if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]{2,}', out):
                raise ValeurInvalide('adresse e-mail invalide')
        elif t == 'gps':
            m = re.fullmatch(r'\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*', v)
            if not m or abs(float(m[1])) > 90 or abs(float(m[2])) > 180:
                raise ValeurInvalide('coordonnées « latitude, longitude » invalides')
            lat, lng = round(float(m[1]), 6), round(float(m[2]), 6)
            return {'texte_element': f'{lat:.6f},{lng:.6f}', 'valeur_json': {'lat': lat, 'lng': lng}, 'est_na': False}
        elif t == 'time':
            m = re.fullmatch(r'(\d{1,2})\s*[:hH]\s*(\d{2})(?::\d{2})?', v)
            if not m or int(m[1]) > 23 or int(m[2]) > 59:
                raise ValeurInvalide('heure attendue au format hh:mm')
            out = f'{int(m[1]):02d}:{m[2]}'
        elif t == 'multi':
            codes = sorted({c.strip() for c in re.split(r'[;,]', v) if c.strip()}, key=lambda c: (len(c), c))
            ok = _codes(spec)
            if ok and not set(codes) <= ok:
                raise ValeurInvalide('choix inconnu : ' + ', '.join(sorted(set(codes) - ok)))
            return {'texte_element': ';'.join(codes) or None, 'valeur_json': codes or None, 'est_na': False}
        elif t == 'long':
            out = v[:2000]
        else:                                                  # texte court (ou type inconnu)
            out = re.sub(r'\s+', ' ', v)[:255 if t == 'text' else 2000]
        return {'texte_element': out, 'est_na': False}

    # ---------------- Nombre ----------------
    if not v:
        return {'m_value': None, 'est_na': False}
    if t == 'yesno':
        low = v.lower()
        if low in OUI:
            return {'m_value': 1.0, 'est_na': False}
        if low in NON:
            return {'m_value': 0.0, 'est_na': False}
        raise ValeurInvalide('réponse Oui / Non attendue')
    x = _nombre(v)
    if t in ('choice', 'scale'):
        ok = _codes(spec) or ({'1', '2', '3', '4', '5'} if t == 'scale' else set())
        code = str(int(x)) if x == int(x) else str(x)
        if ok and code not in ok:
            raise ValeurInvalide(f'code « {v} » absent de la liste')
        return {'m_value': x, 'est_na': False}
    if t in ('int', 'age') and x != int(x):
        raise ValeurInvalide('nombre entier attendu')
    if t == 'age' and not 0 <= x <= 120:
        raise ValeurInvalide('âge hors limites (0 à 120)')
    if t == 'pct' and not 0 <= x <= 100:
        raise ValeurInvalide('pourcentage hors limites (0 à 100)')
    if t == 'money' and x < 0:
        raise ValeurInvalide('montant négatif')
    return {'m_value': x, 'est_na': False}
```


### A2. `save_value` — à coller dans ctn_bpf/views.py

```python
# ======================================================================
#  save_value : à coller dans ctn_bpf/views.py à la place de l'actuelle
#  Imports à ajouter en haut de views.py (s'ils n'y sont pas déjà) :
#
#     import json
#     from django.http import JsonResponse
#     from django.db import transaction as db_transaction
#     from .valeurs import normaliser, ValeurInvalide
# ======================================================================

# Colonnes réellement présentes dans DSet_DElt (valeur_json est facultative)
_CHAMPS_DSET = None


def _champs_dset():
    global _CHAMPS_DSET
    if _CHAMPS_DSET is None:
        _CHAMPS_DSET = {f.name for f in DSet_DElt._meta.get_fields()} | {f.attname for f in DSet_DElt._meta.concrete_fields}
    return _CHAMPS_DSET


def _piece_autorisee(piece_id, user):
    try:
        from saisie_plus.models import PieceJointe
        from saisie_plus.views import peut_voir_piece
    except ImportError:
        return False
    p = PieceJointe.objects.filter(id=piece_id).first()
    return bool(p and peut_voir_piece(user, p))


def _pl(n, sing, plur=None):
    return f"{n} {sing if n <= 1 else (plur or sing + 's')}"


def _texte_recu(r):
    """« 9 valeurs enregistrées : 3 nouvelles, 5 modifiées, 1 inchangée · 2 pièces jointes · 0 ignorée »"""
    det = [x for x in (_pl(r['nouvelles'], 'nouvelle'), _pl(r['modifiees'], 'modifiée'), _pl(r.get('effacees', 0), 'effacée'), _pl(r['inchangees'], 'inchangée')) if not x.startswith('0 ')]
    t = _pl(r['ecrites'], 'valeur enregistrée', 'valeurs enregistrées') + (' : ' + ', '.join(det) if det else '')
    if r['na']:
        t += ' · ' + _pl(r['na'], 'non applicable', 'non applicables')
    if r['pieces']:
        t += ' · ' + _pl(r['pieces'], 'pièce jointe', 'pièces jointes')
    if r['indicateurs']:
        t += ' · ' + _pl(r['indicateurs'], 'indicateur', 'indicateurs')
    t += ' · ' + _pl(len(r['ignorees']), 'ignorée', 'ignorées')
    return t


def save_value(request):
    if request.method != "POST":
        return redirect(request.META.get('HTTP_REFERER', '/'))

    ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'   # page de saisie (enregistrement sans rechargement)
    context = basis(request)

    try:
        dataset_id = int(request.POST.get("dSv_id", 0))
        r_dataset = get_object_or_404(DataSet, id=dataset_id)
        r_period1 = request.POST.get("period1_saisie")
        r_period2 = request.POST.get("period2_saisie")
        structure_id = int(request.POST.get('struc_selec', 0))
        if not r_period2 or not structure_id:
            raise ValeurInvalide("Choisissez l'unité et la période avant d'enregistrer.")

        with db_transaction.atomic():
            # 1. Entité parente (une par enregistrement : sert d'historique)
            entity = DataSetValue.objects.create(
                m_dataset=r_dataset,
                m_user=request.user.personnel,
                m_period_value=r_period1,
                m_sub_period_value=r_period2,
            )

            # reçu d'enregistrement : ce qui a VRAIMENT été écrit en base
            recu = {'ecrites': 0, 'nouvelles': 0, 'modifiees': 0, 'inchangees': 0, 'effacees': 0, 'na': 0, 'pieces': 0,
                    'indicateurs': 0, 'ignorees': [], 'avertissements': []}
            # 2. Indicateurs (inchangé)
            indicator_values = json.loads(request.POST.get('indicator-values', '{}') or '{}')
            for i_id in json.loads(request.POST.get('indicator-ids', '[]') or '[]'):
                val = indicator_values.get(str(i_id))
                if val is not None:
                    recu['indicateurs'] += 1
                    IndicateurValeur.objects.update_or_create(
                        indicateur_id=i_id,
                        periode_ok_id=r_period2,
                        structure_id=structure_id,
                        institution_id=context['actual_institution'].id,
                        defaults={'valeur': val, 'type_donnee': "valeur_form", 'date_saisie': timezone.now()}
                    )

            # 3. Data elements : rangés selon leur nature, normalisés, contrôlés
            element_values = json.loads(request.POST.get('elementsArea', '[]') or '[]')
            ids = [e.get('id') for e in element_values if e.get('id')]
            elements = {str(d.id): d for d in DataElement.objects.filter(id__in=ids)}   # 1 requête au lieu d'une par élément
            erreurs, a_calculer = [], []
            colonnes_valeur = [c for c in ('m_value', 'texte_element', 'date_element', 'fichier_element_id', 'valeur_json', 'est_na') if c in _champs_dset()]
            existants = {x.m_dataelement_id: x for x in DSet_DElt.objects.filter(
                periode_id=r_period2, m_structure_id=structure_id, comment__isnull=True,
                m_dataelement_id__in=[int(i) for i in ids if str(i).isdigit()])}

            for element in element_values:
                e_id, e_val = str(element.get('id') or ''), element.get('value')
                data_element = elements.get(e_id)
                if e_val is None:
                    continue
                if not data_element:
                    recu['ignorees'].append({'id': e_id, 'nom': f'Élément #{e_id}', 'raison': "élément de données introuvable (supprimé ?)"})
                    continue
                na = request.POST.get(f'op_na_D0elt{e_id}') == '1'      # case « N/A » cochée à la saisie
                try:
                    champs = normaliser(data_element.m_value_type, element.get('type', ''), e_val, na)
                except ValeurInvalide as err:
                    erreurs.append(f"{data_element.m_name} : {err}")
                    continue

                pj = champs.get('fichier_element_id')
                if pj and not _piece_autorisee(pj, request.user):   # on ne rattache que ses propres pièces jointes
                    erreurs.append(f"{data_element.m_name} : pièce jointe introuvable, renvoyez le fichier")
                    continue
                if 'fichier_element_id' in champs and 'fichier_element_id' not in _champs_dset():
                    # Colonne fichier_element pas encore ajoutée à DSet_DElt : on ne perd pas la pièce jointe,
                    # son identifiant est rangé dans texte_element (la page de saisie sait le relire).
                    logger.warning("DSet_DElt.fichier_element absent : pièce jointe %s rangée dans texte_element", champs['fichier_element_id'])
                    pj_id = champs.pop('fichier_element_id')
                    champs['texte_element'] = str(pj_id) if pj_id else None
                    if pj_id:
                        recu['pieces'] += 1
                        recu['avertissements'].append(f"{data_element.m_name} : pièce jointe rangée provisoirement en texte (colonne fichier_element à ajouter)")
                perdus = [k for k in champs if k not in _champs_dset() and k in ('m_value', 'texte_element', 'date_element', 'fichier_element_id') and champs[k] not in (None, '')]
                champs = {k: v for k, v in champs.items() if k in _champs_dset()}
                if perdus and not any(champs.get(k) not in (None, '', False) for k in colonnes_valeur):
                    recu['ignorees'].append({'id': e_id, 'nom': data_element.m_name, 'raison': f"colonne {perdus[0]} absente de la base"})
                    continue
                ex = existants.get(data_element.id)
                vide = not any(champs.get(k) not in (None, '', False) for k in colonnes_valeur)
                if vide and ex is None:
                    continue                                      # rien en base, rien à écrire : pas de ligne vide
                if vide:
                    champs.update({k: (False if k == 'est_na' else None) for k in colonnes_valeur})   # on efface tout, y compris un ancien identifiant rangé en texte
                    if any(getattr(ex, k, None) not in (None, '', False) for k in colonnes_valeur):
                        recu['effacees'] += 1                     # champ vidé par l'agent (ex. pièce jointe retirée)
                    else:
                        recu['inchangees'] += 1
                elif ex is None:
                    recu['nouvelles'] += 1
                elif any(getattr(ex, k, None) != champs.get(k, getattr(ex, k, None)) for k in colonnes_valeur):
                    recu['modifiees'] += 1
                else:
                    recu['inchangees'] += 1
                recu['ecrites'] += 1
                recu['na'] += 1 if champs.get('est_na') else 0
                recu['pieces'] += 1 if champs.get('fichier_element_id') else 0
                DSet_DElt.objects.update_or_create(
                    periode_id=r_period2,
                    m_structure_id=structure_id,
                    m_dataelement=data_element,
                    comment__isnull=True,                 # saisie manuelle (les cumuls automatiques ont un commentaire)
                    defaults={**champs, 'm_dataset_value': entity, 'date_saisie': timezone.now(),
                              'comment': None},          # jamais '' : sinon la ligne n'est plus retrouvée et un doublon naît à chaque enregistrement
                )
                if (data_element.m_value_type or 'Number') == 'Number' and 'fichier_element_id' not in champs:
                    a_calculer.append(data_element.id)

            if erreurs:                                   # tout ou rien : l'agent corrige puis renvoie
                raise ValeurInvalide(' ; '.join(erreurs))

            # 4. Calculs analytiques APRÈS l'écriture en base, seulement pour les nombres
            db_transaction.on_commit(lambda ids=tuple(a_calculer): [
                trigger_analytics_calculation.delay(i, structure_id, r_period2) for i in ids
            ])

        recu['heure'] = timezone.localtime().strftime('%H:%M')
        msg = _texte_recu(recu)
        if ajax:
            return JsonResponse({'ok': True, 'message': msg, 'recu': recu})
        messages.success(request, msg)
        for x in recu['ignorees']:
            messages.warning(request, f"Non enregistré : {x['nom']} ({x['raison']})")

    except ValeurInvalide as e:                           # erreur de saisie : message clair pour l'agent
        if ajax:
            return JsonResponse({'ok': False, 'error': str(e)}, status=400)
        messages.error(request, str(e))
    except Exception as e:                                # erreur technique : détail dans les logs
        logger.exception("Erreur lors de la sauvegarde")
        if ajax:
            return JsonResponse({'ok': False, 'error': "Erreur du serveur pendant l'enregistrement. Réessayez ; si cela persiste, prévenez l'administrateur."}, status=500)
        messages.error(request, f"Une erreur est survenue : {e}")

    return redirect(request.META.get('HTTP_REFERER', '/'))
```


### A3. `saisie_plus/formules.py` — indicateurs composites

```python
"""OperaPlus · indicateurs calculés à partir d'autres indicateurs (indicateurs composites / dérivés).

Syntaxe des formules
    $12$   élément de données n° 12 (inchangé)
    #9#    indicateur n° 9 (nouveau)
    ex. Indice de qualité du service = ( #9# + #10# + #11# ) / 3

Principe : « développer » la formule
    Avant tout calcul, chaque #id# est remplacé par la formule de cet indicateur, entre parenthèses,
    et ainsi de suite jusqu'à ne plus contenir que des $id$. Le reste d'OperaPlus (page de saisie,
    /get_elements/, calculs analytiques) continue donc de recevoir une formule « classique ».

    Avantage MEAL : un indicateur composite est toujours recalculé à partir des données brutes
    (numérateurs et dénominateurs), jamais en faisant la moyenne de taux déjà calculés.

Contrôles
    - indicateur inconnu, indicateur en saisie manuelle (sans formule) : refusés ;
    - boucle (A utilise B qui utilise A) : refusée, avec le chemin de la boucle ;
    - profondeur maximale : 10 niveaux.
"""
import ast
import operator
import re

JETON = re.compile(r'\$(\d+)\$|#(\d+)#')
PROFONDEUR_MAX = 10
CHAMPS_FORMULE = ('numerateur', 'm_numerateur', 'formule', 'm_formule', 'm_formula', 'formula')


class FormuleInvalide(ValueError):
    pass


# ---------------------------------------------------------------- accès aux indicateurs
def _modele():
    from django.apps import apps
    return apps.get_model('ctn_bpf', 'Indicateur')


def champ_formule():
    """Nom du champ qui porte la formule (réglable : SAISIE_PLUS_CHAMP_FORMULE dans settings)."""
    from django.conf import settings
    fixe = getattr(settings, 'SAISIE_PLUS_CHAMP_FORMULE', '')
    if fixe:
        return fixe
    noms = {f.name for f in _modele()._meta.get_fields()}
    for c in CHAMPS_FORMULE:
        if c in noms:
            return c
    raise FormuleInvalide("Champ de formule introuvable sur Indicateur : définissez SAISIE_PLUS_CHAMP_FORMULE.")


def charger_formules(ids):
    """{id: formule ou ''} pour les indicateurs demandés (une seule requête)."""
    c = champ_formule()
    return {i: (f or '').strip() for i, f in _modele().objects.filter(id__in=ids).values_list('id', c)}


def nom_indicateur(i):
    o = _modele().objects.filter(id=i).first()
    return str(o) if o else f'#{i}'


# ---------------------------------------------------------------- analyse
def extraire(formule):
    """→ (ids des éléments de données, ids des indicateurs) cités directement."""
    de, ind = [], []
    for m in JETON.finditer(formule or ''):
        (de if m.group(1) else ind).append(int(m.group(1) or m.group(2)))
    return de, ind


def developper(formule, charger=charger_formules, _chemin=()):
    """Remplace récursivement chaque #id# par (formule de l'indicateur). Lève FormuleInvalide."""
    formule = (formule or '').strip()
    _, inds = extraire(formule)
    if not inds:
        return formule
    if len(_chemin) >= PROFONDEUR_MAX:
        raise FormuleInvalide(f"Trop de niveaux d'indicateurs imbriqués (plus de {PROFONDEUR_MAX}).")
    formules = charger(set(inds))
    rempl = {}
    for i in set(inds):
        if i in _chemin:
            boucle = ' → '.join(f'#{x}#' for x in _chemin[_chemin.index(i):] + (i,))
            raise FormuleInvalide(f"Boucle entre indicateurs : {boucle}.")
        if i not in formules:
            raise FormuleInvalide(f"Indicateur #{i}# introuvable.")
        if not formules[i]:
            raise FormuleInvalide(f"L'indicateur #{i}# est en saisie manuelle (sans formule) : il ne peut pas servir dans un calcul.")
        rempl[i] = '(' + developper(formules[i], charger, _chemin + (i,)) + ')'
    return re.sub(r'#(\d+)#', lambda m: rempl[int(m.group(1))], formule)


def verifier(formule, indicateur_id=None, charger=charger_formules):
    """Messages d'erreur (liste vide = formule correcte), à appeler avant d'enregistrer un indicateur."""
    erreurs = []
    if indicateur_id is not None and f'#{indicateur_id}#' in (formule or ''):
        return ["Un indicateur ne peut pas se citer lui-même."]
    try:
        dev = developper(formule, charger, (indicateur_id,) if indicateur_id is not None else ())
    except FormuleInvalide as e:
        return [str(e)]
    try:
        evaluer(dev, {i: 1 for i in extraire(dev)[0]})
    except ZeroDivisionError:
        pass                                           # possible avec des 1 partout : pas une erreur de syntaxe
    except FormuleInvalide as e:
        erreurs.append(str(e))
    return erreurs


# ---------------------------------------------------------------- calcul sûr (sans eval)
_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos}


def evaluer(formule, valeurs):
    """Calcule une formule développée. valeurs = {id_element: nombre}. Élément absent = 0 (comme la page de saisie).
    Lève ZeroDivisionError si division par zéro, FormuleInvalide si la formule est incorrecte."""
    if re.search(r'#\d+#', formule or ''):
        formule = developper(formule)
    expr = JETON.sub(lambda m: f'v{m.group(1)}', formule or '').replace(',', '.')
    if not expr.strip():
        raise FormuleInvalide('Formule vide.')
    try:
        arbre = ast.parse(expr, mode='eval')
    except SyntaxError:
        raise FormuleInvalide('Formule mal écrite (parenthèse, opérateur ou nombre).')

    def calc(n):
        if isinstance(n, ast.Expression):
            return calc(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.Name) and re.fullmatch(r'v\d+', n.id):
            v = valeurs.get(int(n.id[1:]), 0)
            return float(v) if v not in (None, '') else 0.0
        if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](calc(n.left), calc(n.right))
        if isinstance(n, ast.UnaryOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](calc(n.operand))
        raise FormuleInvalide('Élément non autorisé dans la formule.')
    return calc(arbre)


def dependances(formule, charger=charger_formules):
    """Tous les éléments de données nécessaires après développement (pour /get_elements/ → data_elts)."""
    return sorted(set(extraire(developper(formule, charger))[0]))
```


### A4. `saisie_plus/management/commands/dedoublonner_saisies.py`

```python
"""Supprime les doublons de saisie dans ctn_bpf.DSet_DElt, avant de poser la contrainte d'unicité.

Un doublon = plusieurs lignes de SAISIE MANUELLE (comment vide) pour le même
élément de données, la même unité et la même période.

Règle de conservation, par groupe :
    1. la ligne la plus récente qui porte une valeur (nombre, texte, date, pièce jointe ou N/A) ;
    2. à défaut, la ligne la plus récente.
Les autres lignes sont sauvegardées dans un CSV, puis supprimées.

Usage :
    python manage.py dedoublonner_saisies                 # simulation : rien n'est modifié
    python manage.py dedoublonner_saisies --appliquer     # nettoie (sauvegarde CSV d'abord)
    python manage.py dedoublonner_saisies --appliquer --auto   # traite aussi les cumuls automatiques identiques
"""
import csv
import os

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone

CLE = ('m_dataelement_id', 'm_structure_id', 'periode_id')


class Command(BaseCommand):
    help = "Repère et supprime les doublons de saisie (DSet_DElt) en gardant la bonne valeur."

    def add_arguments(self, parser):
        parser.add_argument('--appliquer', action='store_true', help='Modifie la base (sinon simple simulation).')
        parser.add_argument('--auto', action='store_true', help='Dédoublonne aussi les cumuls automatiques au commentaire identique.')
        parser.add_argument('--sauvegarde', default='', help='Chemin du CSV des lignes supprimées.')

    def handle(self, *args, **o):
        M = apps.get_model('ctn_bpf', 'DSet_DElt')
        noms = {f.name for f in M._meta.concrete_fields}
        attn = [f.attname for f in M._meta.concrete_fields]
        valeur = [c for c in ('m_value', 'texte_element', 'date_element', 'fichier_element') if c in noms]
        appliquer = o['appliquer']
        self.stdout.write(self.style.WARNING('SIMULATION : rien ne sera modifié (ajoutez --appliquer).') if not appliquer else 'Nettoyage en cours…')

        # 0. commentaire vide ('' ou espaces) = saisie manuelle : on le ramène à NULL, sinon la contrainte ne le verrait pas
        vides = M.objects.filter(comment__regex=r'^\s*$')
        nb_vides = vides.count()
        self.stdout.write(f'Saisies manuelles avec commentaire vide au lieu de NULL : {nb_vides}')

        def a_une_valeur(x):
            return bool(getattr(x, 'est_na', False)) or any(getattr(x, c + ('_id' if c == 'fichier_element' else ''), None) not in (None, '') for c in valeur)

        def groupes(qs, cle):
            return (qs.filter(**{c.replace('_id', '') + '__isnull': False for c in CLE})
                      .values(*cle).annotate(n=Count('id')).filter(n__gt=1))

        a_supprimer, resume = [], []
        manuelles = M.objects.filter(Q(comment__isnull=True) | Q(comment__regex=r'^\s*$'))
        for g in groupes(manuelles, CLE):
            lignes = list(manuelles.filter(**{c: g[c] for c in CLE}).order_by(F('date_saisie').desc(nulls_last=True), '-id') if 'date_saisie' in noms
                          else manuelles.filter(**{c: g[c] for c in CLE}).order_by('-id'))
            garde = next((x for x in lignes if a_une_valeur(x)), lignes[0])
            autres = [x for x in lignes if x.pk != garde.pk]
            a_supprimer += autres
            resume.append((g, garde, autres))
        nb_auto = 0
        if o['auto']:
            auto = M.objects.exclude(Q(comment__isnull=True) | Q(comment__regex=r'^\s*$'))
            for g in groupes(auto, CLE + ('comment',)):
                lignes = list(auto.filter(**{c: g[c] for c in CLE + ('comment',)}).order_by('-id'))
                a_supprimer += lignes[1:]; nb_auto += len(lignes) - 1

        self.stdout.write(f'Groupes de saisies manuelles en double : {len(resume)}  ·  lignes à supprimer : {len(a_supprimer) - nb_auto}'
                          + (f'  ·  cumuls automatiques en double : {nb_auto}' if o['auto'] else ''))
        for g, garde, autres in resume[:15]:
            self.stdout.write(f"  élément {g['m_dataelement_id']} · unité {g['m_structure_id']} · période {g['periode_id']} : "
                              f"{g['n']} lignes → on garde #{garde.pk}, on retire {', '.join('#' + str(x.pk) for x in autres)}")
        if len(resume) > 15:
            self.stdout.write(f'  … et {len(resume) - 15} autre(s) groupe(s).')

        if not appliquer:
            self.stdout.write(self.style.SUCCESS('Simulation terminée.'))
            return
        if a_supprimer:
            chemin = o['sauvegarde'] or os.path.join(settings.BASE_DIR, 'sauvegardes', f'doublons_dset_delt_{timezone.now():%Y%m%d_%H%M%S}.csv')
            chemin = os.path.abspath(chemin); os.makedirs(os.path.dirname(chemin), exist_ok=True)
            with open(chemin, 'w', newline='', encoding='utf-8') as fh:
                w = csv.writer(fh); w.writerow(attn)
                for x in a_supprimer:
                    w.writerow([getattr(x, a) for a in attn])
            self.stdout.write(f'Sauvegarde des lignes supprimées : {chemin}')
        with transaction.atomic():
            n_vides = vides.update(comment=None)
            n_supp = M.objects.filter(pk__in=[x.pk for x in a_supprimer]).delete()[0] if a_supprimer else 0
        self.stdout.write(self.style.SUCCESS(f'Terminé : {n_vides} commentaire(s) vide(s) remis à NULL, {n_supp} doublon(s) supprimé(s).'))
        restants = groupes(M.objects.filter(comment__isnull=True), CLE).count()
        if restants:
            self.stdout.write(self.style.ERROR(f'Il reste {restants} groupe(s) en double : relancez la commande.'))
        else:
            self.stdout.write('Vous pouvez maintenant ajouter la contrainte d’unicité au modèle et lancer makemigrations / migrate.')
```


### A5. `saisie_plus/urls.py`

```python
from django.urls import path

from . import views

app_name = 'saisie_plus'

urlpatterns = [
    path('api/journal/', views.journal, name='journal'),
    path('api/justifications/', views.justifications, name='justifications'),
    path('api/valeurs/<int:structure_id>/<str:periode>/', views.valeurs, name='valeurs'),
    path('api/en-tete/', views.en_tete_api, name='en_tete_api'),
    path('en-tete/', views.en_tete_page, name='en_tete'),
    path('api/completude/<int:dataset_id>/<str:periode>/', views.completude, name='completude'),
    path('api/fichiers/', views.fichiers, name='fichiers'),
    path('api/fichiers/<int:piece_id>/', views.fichier_info, name='fichier_info'),
    path('fichier/<int:piece_id>/', views.fichier, name='fichier'),
    path('api/indicateurs/', views.indicateurs_api, name='indicateurs'),
    path('api/formules/verifier/', views.formules_verifier, name='formules_verifier'),
]
```


### A6. `saisie_plus/tests/test_formules.py`

```python
from django.test import SimpleTestCase

from saisie_plus.formules import FormuleInvalide, dependances, developper, evaluer, verifier

BASE = {9: '$1$ / $2$ * 100', 10: '$3$ / $4$ * 100', 11: '( #9# + #10# ) / 2', 12: '#11# - #9#', 13: '', 20: '#21#', 21: '#20#'}
charge = lambda ids: {i: BASE[i] for i in ids if i in BASE}


class FormulesTests(SimpleTestCase):
    def test_developpe_en_cascade(self):
        self.assertEqual(developper('#12#', charge), '((( ($1$ / $2$ * 100) + ($3$ / $4$ * 100) ) / 2) - ($1$ / $2$ * 100))')
        self.assertEqual(dependances('#11# + $7$', charge), [1, 2, 3, 4, 7])

    def test_calcul(self):
        v = {1: 30, 2: 60, 3: 45, 4: 50}                 # 50 % et 90 %
        self.assertAlmostEqual(evaluer(developper('#11#', charge), v), 70.0)
        self.assertAlmostEqual(evaluer(developper('#12#', charge), v), 20.0)
        with self.assertRaises(ZeroDivisionError):
            evaluer(developper('#9#', charge), {1: 3})

    def test_erreurs(self):
        self.assertIn('Boucle', verifier('#20#', charger=charge)[0])
        self.assertIn('lui-même', verifier('#5# + 1', indicateur_id=5, charger=charge)[0])
        self.assertIn('Boucle', verifier('#11#', indicateur_id=9, charger=lambda ids: {**charge(ids), **({9: '#11#'} if 9 in ids else {})})[0])
        self.assertIn('saisie manuelle', verifier('#13# * 2', charger=charge)[0])
        self.assertIn('introuvable', verifier('#99#', charger=charge)[0])
        self.assertIn('mal écrite', verifier('( $1$ + ', charger=charge)[0])
        self.assertEqual(verifier('( #9# + #10# ) / 2', charger=charge), [])

    def test_pas_de_code(self):
        with self.assertRaises(FormuleInvalide):
            evaluer('__import__("os")', {})
```
