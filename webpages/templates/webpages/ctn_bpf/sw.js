/* =====================================================================
   OperaPlus — service worker « hors connexion »
   Servi à la RACINE du site (/sw.js) par la vue service_worker (voir hors_ligne_vues.py).

   Ce qu'il fait, et seulement ça :
     • à l'installation, il garde en mémoire la page /hors-ligne/ ;
     • quand une PAGE (navigation) ne peut pas se charger faute de réseau, il affiche /hors-ligne/
       au lieu de l'écran « Vous n'êtes pas connecté » du navigateur.
   Ce qu'il ne fait PAS : il ne met en cache aucune autre page ni aucune donnée (rien de confidentiel
   ne reste sur un téléphone partagé), et il ne touche ni aux formulaires (POST) ni aux appels fetch/AJAX.
   Pour forcer la mise à jour chez tout le monde : changer VERSION.
   ===================================================================== */
const VERSION = 'operaplus-hors-ligne-v1';
const PAGE_HORS_LIGNE = '/hors-ligne/';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(VERSION)
            .then((cache) => cache.add(new Request(PAGE_HORS_LIGNE, { cache: 'reload' })))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((noms) => Promise.all(noms.filter((n) => n.startsWith('operaplus-hors-ligne-') && n !== VERSION).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // Uniquement les chargements de PAGES, en GET, sur notre site
    if (req.mode !== 'navigate' || req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    event.respondWith(
        fetch(req).catch(() =>
            caches.open(VERSION).then((cache) => cache.match(PAGE_HORS_LIGNE)).then((page) =>
                page || new Response('<h1>Pas de connexion internet</h1><p>Réessayez dans un instant.</p>',
                                     { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
        )
    );
});
