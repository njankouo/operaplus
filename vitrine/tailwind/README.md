# Passer Tailwind du CDN à un fichier CSS compilé (production)

Le script `https://cdn.tailwindcss.com` génère le CSS dans le navigateur à chaque visite :
c'est lent (mauvais pour Google) et déconseillé en production. Une fois compilé, le CSS
est un simple fichier mis en cache.

1. Dans le dossier du projet :
   npm init -y
   npm install -D tailwindcss@3.4.16
2. Copiez `tailwind.config.js` et `input.css` (ce dossier) à la racine du projet.
3. Compilez :
   npx tailwindcss -i input.css -o static/css/tailwind.css --minify
   (relancez cette commande à chaque modification des gabarits, ou ajoutez --watch en développement)
4. Dans la base, remplacez la ligne
   <script src="https://cdn.tailwindcss.com"></script>
   par
   <link rel="stylesheet" href="{% static 'css/tailwind.css' %}">
5. python manage.py collectstatic
