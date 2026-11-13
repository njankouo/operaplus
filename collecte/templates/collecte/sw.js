/* OperaPlus Terrain — service worker v{{ version }} */
var VERSION = '{{ version }}', RACINE = '{{ racine }}', CACHE = 'op-terrain-' + VERSION;
importScripts('{{ sync_js }}');
var COQUILLE = [RACINE, '{{ sync_js }}', RACINE + 'manifest.webmanifest'{% for i in icones %}, '{{ i }}'{% endfor %}{% for f in fichiers %}, '{{ f }}'{% endfor %}];

self.addEventListener('install', function (e) {
    e.waitUntil(caches.open(CACHE).then(function (c) {
        return Promise.all(COQUILLE.map(function (u) {
            return fetch(u, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { if (r.ok && !r.redirected) return c.put(u, r); });
        }));
    }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (k) {
        return Promise.all(k.filter(function (n) { return n.indexOf('op-terrain-') === 0 && n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); }));
});

/* Page : le réseau d'abord (pour les mises à jour), la copie locale si pas de réseau ou réseau trop lent (> 4 s). */
function reseauDAbord(req, cle) {
    var reseau = fetch(req).then(function (r) {
        if (r.ok && !r.redirected) { var copie = r.clone(); caches.open(CACHE).then(function (c) { c.put(cle, copie); }); }
        return r;
    });
    var secours = function () {
        return caches.match(cle).then(function (m) {
            return m || new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font-family:sans-serif;padding:2rem">Hors ligne : ouvrez OperaPlus Terrain une première fois avec du réseau.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
    };
    var lent = new Promise(function (ok) { setTimeout(ok, 4000); }).then(function () { return caches.match(cle); });
    return Promise.race([reseau.catch(secours), lent.then(function (m) { return m || reseau.catch(secours); })]).then(function (r) {
        return (r.ok || r.redirected) ? r : caches.match(cle).then(function (m) { return m || r; });
    });
}

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);
    if (url.origin !== location.origin) {
        e.respondWith(caches.match(req).then(function (m) { return m || fetch(req).then(function (r) { if (r.ok) { var c = r.clone(); caches.open(CACHE).then(function (k) { k.put(req, c); }); } return r; }); }));
        return;
    }
    if (url.pathname.indexOf(RACINE + 'api/') === 0) return;                         // données : toujours le réseau
    if (req.mode === 'navigate' && url.pathname === RACINE) { e.respondWith(reseauDAbord(req, RACINE)); return; }
    if (url.pathname.indexOf('/static/') === 0 || url.pathname === RACINE + 'manifest.webmanifest') {
        e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (m) {
            var reseau = fetch(req).then(function (r) { if (r.ok) { var c = r.clone(); caches.open(CACHE).then(function (k) { k.put(req, c); }); } return r; });
            return m || reseau;
        }));
    }
});

function prevenirPages(bilan) {
    return self.clients.matchAll({ includeUncontrolled: true }).then(function (l) { l.forEach(function (c) { c.postMessage({ type: 'synchro', bilan: bilan }); }); });
}

/* Synchro en arrière-plan (Android / Chrome) : se déclenche quand le réseau revient, même appli fermée. */
self.addEventListener('sync', function (e) {
    if (e.tag === 'op-envois') e.waitUntil(OPT.synchroniser(RACINE, {}).then(function (b) {
        if (b && b.stable === false) throw new Error('réseau instable');                 // le navigateur réessaiera
        return prevenirPages(b).then(function () {
            if (b && b.envoyes && self.registration.showNotification) {
                return self.registration.showNotification('OperaPlus Terrain', { body: b.envoyes + ' envoi(s) synchronisé(s).', icon: '{{ icone }}', tag: 'op-sync', silent: true }).catch(function () {});
            }
        });
    }));
});
self.addEventListener('periodicsync', function (e) {
    if (e.tag === 'op-envois') e.waitUntil(OPT.synchroniser(RACINE, {}).then(prevenirPages));
});
self.addEventListener('message', function (e) {
    if (e.data === 'synchroniser') e.waitUntil(OPT.synchroniser(RACINE, {}).then(prevenirPages));
    if (e.data === 'skipWaiting') self.skipWaiting();
});
