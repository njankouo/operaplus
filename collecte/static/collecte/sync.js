/* OperaPlus Terrain — stockage local (IndexedDB) et synchronisation.
   Utilisé à la fois par la page et par le service worker (synchro en arrière-plan). Aucun accès au DOM. */
(function (g) {
    'use strict';
    var NOM_BASE = 'op-terrain', VERSION_BASE = 1, base = null;

    function ouvrir() {
        if (base) return Promise.resolve(base);
        return new Promise(function (ok, ko) {
            var r = indexedDB.open(NOM_BASE, VERSION_BASE);
            r.onupgradeneeded = function () {
                var db = r.result;
                if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
                if (!db.objectStoreNames.contains('envois')) db.createObjectStore('envois', { keyPath: 'uuid' });
                if (!db.objectStoreNames.contains('brouillons')) db.createObjectStore('brouillons', { keyPath: 'uuid' });
            };
            r.onsuccess = function () { base = r.result; base.onversionchange = function () { base.close(); base = null; }; ok(base); };
            r.onerror = function () { ko(r.error); };
        });
    }
    function req(magasin, mode, action) {
        return ouvrir().then(function (db) {
            return new Promise(function (ok, ko) {
                var t = db.transaction(magasin, mode), s = t.objectStore(magasin), r = action(s), res;
                if (r) r.onsuccess = function () { res = r.result; };
                t.oncomplete = function () { ok(res); };
                t.onerror = t.onabort = function () { ko(t.error); };
            });
        });
    }
    var DB = {
        lire: function (k) { return req('kv', 'readonly', function (s) { return s.get(k); }); },
        ecrire: function (k, v) { return req('kv', 'readwrite', function (s) { return s.put(v, k); }); },
        tout: function (m) { return req(m, 'readonly', function (s) { return s.getAll(); }); },
        un: function (m, k) { return req(m, 'readonly', function (s) { return s.get(k); }); },
        mettre: function (m, o) { return req(m, 'readwrite', function (s) { return s.put(o); }); },
        oter: function (m, k) { return req(m, 'readwrite', function (s) { return s.delete(k); }); }
    };

    function uuid() {
        if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
        var b = new Uint8Array(16); g.crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
        var h = [].map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
        return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    }
    function attendre(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
    function appel(url, options, delai) {
        var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, minuteur;
        options = options || {};
        options.credentials = 'same-origin';
        options.cache = 'no-store';
        if (ctl) { options.signal = ctl.signal; minuteur = setTimeout(function () { ctl.abort(); }, delai || 60000); }
        return fetch(url, options).finally(function () { clearTimeout(minuteur); });
    }

    /* Réseau « stable » = 2 réponses du serveur de suite, chacune en moins de 4 s. */
    function reseauStable(racine) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ stable: false, raison: 'hors_ligne' });
        var n = 0;
        function essai() {
            var t0 = Date.now();
            return appel(racine + 'api/ping/?t=' + t0, { method: 'GET' }, 6000).then(function (r) {
                if (!r.ok) return { stable: false, raison: 'serveur' };
                return r.json().then(function (j) {
                    if (Date.now() - t0 > 4000) return { stable: false, raison: 'lent' };
                    if (!j.connecte) return { stable: false, raison: 'deconnecte' };
                    n++;
                    return n >= 2 ? { stable: true } : attendre(700).then(essai);
                });
            }, function () { return { stable: false, raison: 'hors_ligne' }; });
        }
        return essai();
    }

    function Erreur(message, type) { var e = new Error(message); e.type = type; return e; }

    function poster(url, corps, csrf, json) {
        var h = { 'X-CSRFToken': csrf || '', 'X-Requested-With': 'OperaPlusTerrain' };
        if (json) h['Content-Type'] = 'application/json';
        return appel(url, { method: 'POST', body: json ? JSON.stringify(corps) : corps, headers: h }, 120000).then(function (r) {
            if (r.status === 401) throw Erreur('Session expirée : reconnectez-vous.', 'deconnecte');
            return r.text().then(function (t) {
                var j = null; try { j = JSON.parse(t); } catch (e) {}
                if (r.status === 403 && !j) throw Erreur('Sécurité : ouvrez l’application une fois avec du réseau pour la réactiver.', 'deconnecte');
                if (!j) throw Erreur('Réponse inattendue du serveur (' + r.status + ').', 'reseau');
                if (!r.ok || !j.ok) { var e = Erreur(j.message || ('Erreur ' + r.status), j.definitif ? 'definitif' : (r.status === 409 ? 'attente' : 'serveur')); throw e; }
                return j;
            });
        }, function () { throw Erreur('Réseau interrompu pendant l’envoi.', 'reseau'); });
    }

    var CORRESP = { recu: 'recu_serveur', valide: 'valide', rejete: 'rejete', integre: 'integre', erreur: 'recu_serveur' };
    var FINAUX = ['integre', 'valide', 'rejete'];

    function envoyer(racine, e, csrf) {
        e.statut = 'envoi';
        return DB.mettre('envois', e).then(function () {
            if (e.type === 'declaration') {
                var fd = new FormData(), p = e.contenu;
                Object.keys(p).forEach(function (k) { if (p[k] !== null && p[k] !== undefined && k !== 'fichier') fd.append(k, p[k]); });
                fd.append('uuid', e.uuid);
                if (p.fichier) fd.append('fichier', p.fichier, p.fichier_nom || 'piece.jpg');
                return poster(racine + 'api/declaration/', fd, csrf).then(function (j) {
                    e.statut = CORRESP[j.statut] || 'recu_serveur'; e.message = j.message || '';
                    if (e.contenu.fichier) { e.contenu.fichier = null; e.contenu.fichier_envoye = true; }
                });
            }
            var etape = e.serveur_ok ? Promise.resolve() : poster(racine + 'api/soumission/', {
                uuid: e.uuid, formulaire_id: e.contenu.formulaire_id, version: e.contenu.version, donnees: e.contenu.donnees,
                gps: e.contenu.gps, cree_le: e.contenu.cree_le, pieces: (e.fichiers || []).length
            }, csrf, true).then(function () { e.serveur_ok = true; return DB.mettre('envois', e); });
            return etape.then(function () {
                var restant = (e.fichiers || []).filter(function (f) { return !f.envoye; });
                return restant.reduce(function (ch, f) {
                    return ch.then(function () {
                        var fd = new FormData();
                        fd.append('uuid', f.uuid); fd.append('soumission', e.uuid); fd.append('question', f.question);
                        fd.append('fichier', f.blob, f.nom || 'photo.jpg');
                        return poster(racine + 'api/piece/', fd, csrf).then(function () { f.envoye = true; f.blob = null; return DB.mettre('envois', e); });
                    });
                }, Promise.resolve());
            }).then(function () { e.statut = 'recu_serveur'; e.message = ''; });
        }).then(function () { e.envoye_le = Date.now(); return DB.mettre('envois', e); });
    }

    var verrou = false;
    function synchroniser(racine, opts) {
        opts = opts || {};
        if (verrou) return Promise.resolve({ occupe: true });
        verrou = true;
        var bilan = { envoyes: 0, erreurs: 0, stable: true };
        return (opts.force ? Promise.resolve({ stable: navigator.onLine !== false }) : reseauStable(racine)).then(function (s) {
            if (!s.stable) { bilan.stable = false; bilan.raison = s.raison; return bilan; }
            return Promise.all([DB.tout('envois'), opts.csrf ? Promise.resolve(opts.csrf) : DB.lire('csrf')]).then(function (r) {
                var maintenant = Date.now(), csrf = r[1];
                var liste = r[0].filter(function (e) {
                    return (e.statut === 'en_attente' || e.statut === 'erreur' || e.statut === 'envoi') && (opts.force || !e.prochain || e.prochain <= maintenant);
                }).sort(function (a, b) { return a.cree_le - b.cree_le; });
                return liste.reduce(function (ch, e) {
                    return ch.then(function () {
                        if (bilan.deconnecte) return;
                        return envoyer(racine, e, csrf).then(function () { bilan.envoyes++; }, function (err) {
                            if (err.type === 'deconnecte') { bilan.deconnecte = true; e.statut = 'en_attente'; e.message = err.message; return DB.mettre('envois', e); }
                            bilan.erreurs++;
                            e.essais = (e.essais || 0) + 1;
                            e.message = err.message;
                            if (err.type === 'definitif') e.statut = 'rejete';
                            else { e.statut = 'erreur'; e.prochain = Date.now() + Math.min(30 * 60000, Math.pow(2, e.essais) * 15000); }
                            return DB.mettre('envois', e);
                        });
                    });
                }, Promise.resolve()).then(function () { return csrf; });
            }).then(function (csrf) {
                if (bilan.deconnecte) return bilan;
                return actualiserEtats(racine, csrf).then(function () { return DB.ecrire('derniere_synchro', Date.now()); }).then(function () { return bilan; });
            });
        }).finally(function () { verrou = false; });
    }

    function actualiserEtats(racine, csrf) {
        return DB.tout('envois').then(function (l) {
            var attente = l.filter(function (e) { return e.statut === 'recu_serveur'; });
            if (!attente.length) return;
            return poster(racine + 'api/etat/', { uuids: attente.map(function (e) { return e.uuid; }) }, csrf, true).then(function (j) {
                return attente.reduce(function (ch, e) {
                    var et = j.etats[e.uuid];
                    if (!et) return ch;
                    var nouveau = CORRESP[et.statut] || e.statut;
                    if (nouveau === e.statut && (et.message || '') === (e.message || '')) return ch;
                    e.statut = nouveau; e.message = et.message || e.message;
                    return ch.then(function () { return DB.mettre('envois', e); });
                }, Promise.resolve());
            }).catch(function () {});
        });
    }

    /* Nettoyage : les envois terminés depuis plus de 30 jours sont retirés du téléphone. */
    function nettoyer(jours) {
        var limite = Date.now() - (jours || 30) * 86400000;
        return DB.tout('envois').then(function (l) {
            return Promise.all(l.filter(function (e) { return FINAUX.indexOf(e.statut) >= 0 && (e.envoye_le || e.cree_le) < limite; })
                .map(function (e) { return DB.oter('envois', e.uuid); }));
        });
    }

    g.OPT = { DB: DB, uuid: uuid, reseauStable: reseauStable, synchroniser: synchroniser, nettoyer: nettoyer, FINAUX: FINAUX, appel: appel };
})(typeof self !== 'undefined' ? self : this);
