/* OperaPlus Terrain v1.3 — interface. Données et synchronisation : sync.js */
(function () {
  'use strict';
  var C = window.OP_CONF, R = C.racine, DB = OPT.DB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var vue = $('#tVue'), pied = $('#tPied'), couche = $('#tCouche');
  var etat = { paquet: null, envois: [], brouillons: [], synchro: false, installer: null, decl: null, derniere: 0,
               reglages: { sync_auto: true, photos_legeres: true }, filtre: 'toutes', role: 'R' };

  /* =============== utilitaires =============== */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(t, ms) { var b = $('#tToast'); b.innerHTML = '<div role="status">' + esc(t) + '</div>'; clearTimeout(toast.m); toast.m = setTimeout(function () { b.innerHTML = ''; }, ms || 3200); }
  function csrf() { var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/); return m ? decodeURIComponent(m[1]) : C.csrf; }
  function aujourdhui() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function dateFr(iso) { if (!iso) return ''; var p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function dateCourte(iso) { if (!iso) return ''; return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  function quand(ms) {
    if (!ms) return 'jamais'; var s = (Date.now() - ms) / 1000;
    if (s < 60) return 'à l’instant'; if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h'; return 'le ' + new Date(ms).toLocaleDateString('fr-FR');
  }
  function court(ms) { var s = (Date.now() - ms) / 1000; return s < 60 ? 'à l’instant' : s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? Math.round(s / 3600) + ' h' : new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  function taille(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' Ko' : (n / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
  function initiales(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (m) { return m[0]; }).join('').toUpperCase(); }
  var ICO = {
    ok: '<path d="M20 6L9 17l-5-5"/>', ko: '<path d="M18 6L6 18M6 6l12 12"/>', att: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    up: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>', alerte: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    form: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>', tache: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 10l2.5 2.5L16 8M8 16h8"/>',
    chev: '<path d="M9 18l6-6-6-6"/>', retour: '<path d="M15 18l-6-6 6-6"/>', cam: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    fichier: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', gps: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    brouillon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M12 20h.01"/>',
    wifioff: '<path d="M2 2l20 20M8.5 16.1a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5.2-2.8M19 12.6a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
    sync: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    reglage: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', aide: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    bureau: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>', stock: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', maison: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    corbeille: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', install: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function ico(n) { return '<svg viewBox="0 0 24 24">' + (ICO[n] || '') + '</svg>'; }
  var LOGO = '<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#5B3FE0"/><circle cx="240" cy="246" r="128" fill="none" stroke="#7E68F0" stroke-width="56"/><path d="M240 118A128 128 0 1 1 119.7 202.2" fill="none" stroke="#fff" stroke-width="56" stroke-linecap="round"/><circle cx="372" cy="374" r="92" fill="#5B3FE0"/><circle cx="372" cy="374" r="76" fill="#F59E0B"/><path d="M372 336V412M334 374H410" stroke="#fff" stroke-width="24" stroke-linecap="round"/></svg>';

  /* =============== réglages et thème =============== */
  function chargerReglages() { return DB.lire('reglages').then(function (r) { if (r) Object.assign(etat.reglages, r); }); }
  function reglage(k, v) { etat.reglages[k] = v; return DB.ecrire('reglages', etat.reglages); }
  var TEINTES = [['violet', '#5B3FE0', 'Violet'], ['indigo', '#3346A8', 'Indigo'], ['emeraude', '#0F7B6C', 'Émeraude'], ['corail', '#D9452E', 'Corail'], ['ardoise', '#334155', 'Ardoise']];
  function lireTheme() { try { return JSON.parse(localStorage.getItem('op-terrain-theme') || '{}'); } catch (e) { return etat.reglages.theme || {}; } }
  function appliquerTheme(t) {
    var m = t.mode || 'auto', h = document.documentElement;
    if (m === 'auto') m = matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
    h.dataset.mode = m; h.dataset.couleur = t.couleur || 'violet';
    couleurBarre();
  }
  function couleurBarre() {
    var meta = document.querySelector('meta[name=theme-color]'), cs = getComputedStyle(document.documentElement);
    var sombre = ['accueil', 'profil'].indexOf(document.body.dataset.ecran) >= 0;
    if (meta) meta.content = (sombre ? cs.getPropertyValue('--hero') : cs.getPropertyValue('--bg')).trim();
  }
  function choisirTheme(maj) {
    var t = Object.assign(lireTheme(), maj);
    try { localStorage.setItem('op-terrain-theme', JSON.stringify(t)); } catch (e) {}
    reglage('theme', t); appliquerTheme(t);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if ((lireTheme().mode || 'auto') === 'auto') appliquerTheme(lireTheme()); });

  /* =============== état de synchronisation (puce cliquable) =============== */
  function attente() { return etat.envois.filter(function (x) { return x.statut === 'en_attente' || x.statut === 'erreur' || x.statut === 'envoi'; }).length; }
  function syncInterieur() {
    var n = attente();
    if (etat.synchro) return { c: 'cours', h: ico('sync') + '<span class="txt">Synchronisation…</span>' };
    if (!navigator.onLine) return { c: 'off', h: '<i class="pt"></i>Hors ligne' + (n ? '<em class="txt">· ' + n + ' gardé' + (n > 1 ? 's' : '') + '</em>' : '') };
    if (n) return { c: 'att', h: ico('up') + n + ' à envoyer' };
    return { c: '', h: '<i class="pt"></i>À jour' + (etat.derniere ? '<em class="txt">· ' + court(etat.derniere) + '</em>' : '') };
  }
  function puceSync() { var s = syncInterieur(); return '<button class="t-sync js-sync ' + s.c + '" data-sync aria-label="Synchroniser maintenant">' + s.h + '</button>'; }
  function majEtat() {
    var s = syncInterieur(), n = attente();
    document.querySelectorAll('.js-sync').forEach(function (b) { b.className = 't-sync js-sync ' + s.c; b.innerHTML = s.h; });
    $('#tNb2').textContent = n || '';
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-sync]')) synchroniser(true); });
  function banniere(type, html) { var b = $('#tBanniere'); if (!html) { b.hidden = true; return; } b.className = 't-ban ' + type; b.innerHTML = html; b.hidden = false; }

  /* =============== données locales =============== */
  function charger() {
    return Promise.all([DB.lire('paquet'), DB.tout('envois'), DB.tout('brouillons'), DB.lire('derniere_synchro')]).then(function (r) {
      etat.paquet = r[0] || null; etat.envois = (r[1] || []).sort(function (a, b) { return b.cree_le - a.cree_le; }); etat.brouillons = r[2] || []; etat.derniere = r[3] || 0;
      majEtat();
    });
  }
  function actualiserPaquet() {
    return OPT.appel(R + 'api/paquet/', {}, 20000).then(function (r) {
      if (r.status === 401) { deconnecte(); return; }
      if (!r.ok) return;
      return r.json().then(function (j) {
        if (!j.ok) return;
        etat.paquet = j; C.csrf = j.csrf;
        return Promise.all([DB.ecrire('paquet', j), DB.ecrire('csrf', j.csrf)]);
      });
    }).catch(function () {});
  }
  function deconnecte() {
    banniere('ko', ico('alerte') + '<span>Session expirée. Vos données restent sur le téléphone. <a href="' + esc(C.login) + '">Se reconnecter</a> avec du réseau pour les envoyer.</span>');
  }
  function enregistrerEnvoi(e) {
    e.statut = 'en_attente'; e.cree_le = Date.now(); e.essais = 0;
    return DB.mettre('envois', e).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(function (reg) { if (reg.sync) reg.sync.register('op-envois').catch(function () {}); });
      return charger();
    }).then(function () { if (etat.reglages.sync_auto) setTimeout(function () { synchroniser(false, true); }, 400); });
  }

  /* =============== synchronisation =============== */
  function synchroniser(manuel, discret) {
    if (etat.synchro) return Promise.resolve();
    if (!manuel && !etat.reglages.sync_auto) return Promise.resolve();
    if (!navigator.onLine) { if (manuel) toast('Pas de réseau : vos données restent sur le téléphone et partiront automatiquement.'); return Promise.resolve(); }
    etat.synchro = true; majEtat();
    return OPT.synchroniser(R, { csrf: csrf() }).then(function (b) {
      if (b.occupe) return;
      if (b.deconnecte) { deconnecte(); return; }
      if (!b.stable) {
        if (b.raison === 'deconnecte') deconnecte();
        else if (manuel) toast('Réseau trop faible pour l’instant. Nouvel essai automatique dès qu’il se stabilise.');
        return;
      }
      banniere();
      return actualiserPaquet().then(function () {
        if (b.envoyes && !discret) toast(b.envoyes + ' envoi' + (b.envoyes > 1 ? 's' : '') + ' synchronisé' + (b.envoyes > 1 ? 's' : '') + '.');
        else if (b.envoyes) toast('Envoyé à OperaPlus ✓');
        else if (b.erreurs) toast(b.erreurs + ' envoi(s) en erreur : voir Envois.');
        else if (manuel) toast('Tout est à jour.');
      });
    }).catch(function () { if (manuel) toast('La synchronisation a échoué. Nouvel essai plus tard.'); })
      .finally(function () { etat.synchro = false; return OPT.nettoyer(30).then(charger).then(function () { if (ecranRafraichissable()) router(true); }); });
  }
  function ecranRafraichissable() {
    if (couche.innerHTML) return false;
    var h = location.hash.slice(1).split('/')[0] || 'accueil';
    return ['accueil', 'taches', 'envois', 'profil', 'parametres', 'questionnaires'].indexOf(h) >= 0;
  }
  window.addEventListener('online', function () { majEtat(); setTimeout(function () { synchroniser(false); }, 3000); });
  window.addEventListener('offline', majEtat);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') synchroniser(false); });
  setInterval(function () { var a = etat.envois.some(function (x) { return x.statut === 'en_attente' || x.statut === 'erreur'; }); if (navigator.onLine && a) synchroniser(false); else majEtat(); }, 60000);

  /* tirer vers le bas pour actualiser */
  (function () {
    var ptr = $('#tPtr'), y0 = null, dy = 0, SEUIL = 78;
    window.addEventListener('touchstart', function (e) { y0 = (window.scrollY <= 0 && ecranRafraichissable() && !couche.innerHTML) ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0);
      var d = Math.min(dy * 0.55, 110); ptr.style.transform = 'translateY(' + (d - 60) + 'px) rotate(' + (d * 3) + 'deg)'; ptr.style.opacity = Math.min(1, d / 50);
    }, { passive: true });
    window.addEventListener('touchend', function () {
      if (y0 === null) return; y0 = null;
      if (dy * 0.55 >= SEUIL) {
        ptr.classList.add('tourne'); ptr.style.transform = 'translateY(20px)';
        (navigator.onLine ? synchroniser(true) : Promise.resolve(toast('Hors ligne : rien à actualiser pour l’instant.'))).finally(function () { ptr.classList.remove('tourne'); ptr.style.opacity = 0; ptr.style.transform = 'translateY(-70px)'; });
      } else { ptr.style.opacity = 0; ptr.style.transform = 'translateY(-70px)'; }
    });
  })();

  /* =============== navigation =============== */
  function aller(h) { if (location.hash === '#' + h) router(); else location.hash = h; }
  window.addEventListener('hashchange', function () { router(); });
  $('#tNav').addEventListener('click', function (e) { var b = e.target.closest('[data-route]'); if (b) aller(b.dataset.route); });
  function onglet(n) { document.querySelectorAll('#tNav [data-route]').forEach(function (b) { b.classList.toggle('on', b.dataset.route === n); }); }
  function router(garderDefilement) {
    var p = (location.hash.slice(1) || 'accueil').split('/'), y = window.scrollY;
    pied.innerHTML = ''; document.body.dataset.ecran = p[0]; couleurBarre();
    onglet({ declarer: 'taches', remplir: 'accueil', recap: 'accueil', questionnaires: 'accueil', parametres: 'profil' }[p[0]] || p[0]);
    if (!etat.paquet && ['profil', 'parametres', 'envois'].indexOf(p[0]) < 0) ecranSansPaquet();
    else if (p[0] === 'declarer') ecranDeclaration(p[1]);
    else if (p[0] === 'remplir') ecranQuestion(p[1]);
    else if (p[0] === 'recap') ecranRecap(p[1]);
    else ({ accueil: ecranAccueil, taches: ecranTaches, questionnaires: ecranQuestionnaires, envois: ecranEnvois, profil: ecranProfil, parametres: ecranParametres }[p[0]] || ecranAccueil)();
    window.scrollTo(0, garderDefilement === true ? y : 0);
  }
  function enTete(titre, sous, cible) {
    return '<header class="t-head">' + (cible ? '<button class="t-retour" data-retour="' + cible + '" aria-label="Retour">' + ico('retour') + '</button>' : '') +
      '<div class="tt"><h1>' + titre + '</h1>' + (sous ? '<p>' + sous + '</p>' : '') + '</div>' + puceSync() + '</header>';
  }
  vue.addEventListener('click', function (e) { var b = e.target.closest('[data-retour]'); if (b) aller(b.dataset.retour || 'accueil'); });
  function ecranSansPaquet() {
    vue.innerHTML = enTete('Bienvenue', '') + '<div class="t-vide"><div class="ill">' + ico('wifi') + '</div><b>Première ouverture</b>Ouvrez l’application une fois avec du réseau pour télécharger vos tâches et questionnaires. Ensuite, elle fonctionne sans réseau.<br><br><button class="c-btn c-btn-p" id="tCharger">Télécharger maintenant</button></div>';
    $('#tCharger').onclick = function () { toast('Téléchargement…'); actualiserPaquet().then(function () { if (!etat.paquet) toast('Impossible : vérifiez le réseau.'); router(); }); };
  }

  /* =============== feuille + bouton « + » =============== */
  function feuille(html) {
    couche.innerHTML = '<div class="t-voile" id="tVoile"><div class="t-feuille" role="dialog" aria-modal="true"><div class="poignee"></div>' + html + '</div></div>';
    $('#tVoile').onclick = function (e) { if (e.target.id === 'tVoile' || e.target.closest('[data-fermer]')) couche.innerHTML = ''; };
  }
  $('#tPlus').addEventListener('click', function () {
    var nt = aDeclarer().length, nf = etat.paquet ? (etat.paquet.formulaires || []).length : 0;
    feuille('<h2>Nouvelle saisie</h2><div class="t-groupe">' +
      '<button class="t-row" data-go="taches" data-r="R"><span class="ic">' + ico('tache') + '</span><span class="ct"><b>Déclarer un avancement</b><small>' + nt + ' échéance' + (nt > 1 ? 's' : '') + ' à déclarer</small></span><span class="chev">' + ico('chev') + '</span></button>' +
      '<button class="t-row" data-go="questionnaires"><span class="ic" style="background:var(--or-s);color:var(--or)">' + ico('form') + '</span><span class="ct"><b>Remplir un questionnaire</b><small>' + nf + ' disponible' + (nf > 1 ? 's' : '') + (etat.brouillons.length ? ' · ' + etat.brouillons.length + ' à terminer' : '') + '</small></span><span class="chev">' + ico('chev') + '</span></button></div>' +
      '<button class="c-btn c-btn-s" data-fermer style="width:100%">Annuler</button>');
    couche.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { couche.innerHTML = ''; if (b.dataset.r) { etat.role = 'R'; etat.filtre = 'toutes'; } aller(b.dataset.go); }; });
  });

  /* =============== rôles RACI =============== */
  var ROLES = {
    R: { nom: 'Responsable', long: 'Responsable', desc: 'Vous <b>réalisez</b> l’activité et <b>déclarez</b> son avancement.' },
    A: { nom: 'Approbateur', long: 'Approbateur · Accountable', desc: 'Vous <b>validez</b> les déclarations et répondez du résultat.' },
    C: { nom: 'Consulté', long: 'Consulté · Consulted', desc: 'On vous demande votre <b>avis</b> avant ou pendant l’activité.' },
    I: { nom: 'Informé', long: 'Informé · Informed', desc: 'Vous êtes <b>tenu au courant</b>, sans action à faire.' }
  };
  function listeRole(r) { if (!etat.paquet) return []; return r === 'R' ? (etat.paquet.taches || []) : ((etat.paquet.raci || {})[r] || []); }
  function compteRole(r) { return listeRole(r).length; }
  function enRetard(t) { return !!t.date_echeance && t.date_echeance < aujourdhui() && t.niveau_actuel < 100; }
  function envoiDeTache(t) { return etat.envois.filter(function (e) { return e.type === 'declaration' && String(e.contenu.echeance_id) === String(t.echeance_id) && e.statut !== 'rejete'; })[0]; }
  function aDeclarer() { return (etat.paquet ? etat.paquet.taches || [] : []).filter(function (t) { return !envoiDeTache(t); }); }

  function miniAnneau(n, r) {
    var c = 2 * Math.PI * 19, col = n >= 100 ? 'var(--ok)' : 'var(--v)';
    return '<span class="t-mini-ring"><svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" stroke="var(--v-s)"/><circle cx="23" cy="23" r="19" stroke="' + col + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - Math.min(100, n) / 100)).toFixed(1) + '"/></svg><em>' + Math.round(n) + '%</em>' + (r ? '<span class="role r-' + r + '">' + r + '</span>' : '') + '</span>';
  }
  function puceTache(t) {
    var env = envoiDeTache(t);
    if (env) return env.statut === 'integre' || env.statut === 'valide' ? '<span class="t-puce ok">' + ico('ok') + ' Envoyée</span>' : (env.statut === 'recu_serveur' ? '<span class="t-puce v">Reçue</span>' : '<span class="t-puce or">' + ico('att') + ' En attente d’envoi</span>');
    if (enRetard(t)) return '<span class="t-puce ko">En retard · ' + dateCourte(t.date_echeance) + '</span>';
    if (t.niveau_actuel >= 100) return '<span class="t-puce ok">Terminée</span>';
    return '<span class="t-puce">' + (t.niveau_actuel > 0 ? 'En cours' : 'À faire') + (t.date_echeance ? ' · ' + dateCourte(t.date_echeance) : '') + '</span>';
  }
  function ligneTache(t) {
    return '<button class="t-row" data-decl="' + t.echeance_id + '" data-txt="' + esc((t.operation_nom + ' ' + t.tache_nom).toLowerCase()) + '">' + miniAnneau(t.niveau_actuel, 'R') +
      '<span class="ct"><b>' + esc(t.operation_nom) + '</b>' + (t.tache_nom ? '<small>' + esc(t.tache_nom) + '</small>' : '') + '<span class="t-meta">' + puceTache(t) + '</span></span><span class="chev">' + ico('chev') + '</span></button>';
  }
  function ligneOp(t, r) {
    var p = '';
    if (enRetard(t)) p += '<span class="t-puce ko">En retard · ' + dateCourte(t.date_echeance) + '</span>';
    else if (t.niveau_actuel >= 100) p += '<span class="t-puce ok">Terminée</span>';
    else if (t.date_echeance) p += '<span class="t-puce">Échéance ' + dateCourte(t.date_echeance) + '</span>';
    if (r === 'A' && t.echeances_attente) p += '<span class="t-puce or">' + t.echeances_attente + ' non déclarée' + (t.echeances_attente > 1 ? 's' : '') + '</span>';
    if (t.responsable) p += '<span class="t-pers"><i>' + esc(initiales(t.responsable)) + '</i>' + esc(t.responsable) + '</span>';
    return '<button class="t-row" data-op="' + t.operation_id + '" data-role="' + r + '" data-txt="' + esc((t.operation_nom + ' ' + t.tache_nom + ' ' + (t.responsable || '')).toLowerCase()) + '">' + miniAnneau(t.niveau_actuel, r) +
      '<span class="ct"><b>' + esc(t.operation_nom) + '</b>' + (t.tache_nom ? '<small>' + esc(t.tache_nom) + '</small>' : '') + '<span class="t-meta">' + p + '</span></span><span class="chev">' + ico('chev') + '</span></button>';
  }
  function brancherLignes() {
    vue.querySelectorAll('[data-decl]').forEach(function (b) { b.onclick = function () { aller('declarer/' + b.dataset.decl); }; });
    vue.querySelectorAll('[data-op]').forEach(function (b) { b.onclick = function () { ficheOperation(b.dataset.op, b.dataset.role); }; });
  }

  /* =============== ACCUEIL =============== */
  function ecranAccueil() {
    var l = etat.paquet.taches || [], h = new Date().getHours();
    var moy = l.length ? Math.round(l.reduce(function (s, t) { return s + Math.min(100, t.niveau_actuel); }, 0) / l.length) : 100;
    var aFaire = aDeclarer(), retard = aFaire.filter(enRetard).length;
    var envoyees = etat.envois.filter(function (e) { return ['recu_serveur', 'integre', 'valide'].indexOf(e.statut) >= 0; }).length;
    var circ = 2 * Math.PI * 52, nf = (etat.paquet.formulaires || []).length, br = etat.brouillons.length;
    var html = '<section class="t-hero">' +
      '<svg class="deco" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="148"/><circle cx="150" cy="150" r="110" class="a"/><circle cx="150" cy="150" r="72"/></svg>' +
      '<div class="t-hero-top"><span class="date">' + esc(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })) + '</span><button class="t-av" data-go="profil" aria-label="Mon profil">' + esc(initiales(C.nom)) + '</button></div>' +
      '<h1>' + (h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir') + ',<br><span>' + esc(C.prenom || C.nom) + '</span></h1>' + puceSync() +
      '<div class="t-hero-kpi"><div class="t-ring big"><svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,.1)" stroke-width="10"/>' +
      '<circle cx="60" cy="60" r="52" stroke="var(--v-h)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - moy / 100)).toFixed(1) + '"/></svg>' +
      '<span class="val"><b class="num">' + moy + '<small>%</small></b><span>Avancement</span></span></div>' +
      '<ul><li><i style="background:var(--v-h)"></i><b>' + aFaire.length + '</b>à déclarer</li><li><i style="background:#F87171"></i><b>' + retard + '</b>en retard</li><li><i style="background:#4ADE80"></i><b>' + envoyees + '</b>envoyée' + (envoyees > 1 ? 's' : '') + '</li></ul></div></section>';
    html += '<nav class="t-raci" aria-label="Mes rôles">' + ['R', 'A', 'C', 'I'].map(function (r) {
      return '<button data-role-go="' + r + '"><span class="l r-' + r + '">' + r + '</span><b class="num">' + compteRole(r) + '</b><small>' + ROLES[r].nom + '</small></button>';
    }).join('') + '</nav>';
    if (etat.installer) html += '<div class="t-ban info" style="margin:0 0 1rem">' + ico('install') + '<span>Installez l’application sur ce téléphone. <button id="tInst1">Installer</button></span></div>';
    html += '<div class="t-actions"><button class="p" data-role-go="R"><span class="ic">' + ico('tache') + '</span><span><b>Déclarer un avancement</b><small>' + aFaire.length + ' échéance' + (aFaire.length > 1 ? 's' : '') + ' à faire</small></span></button>' +
      '<button class="s" data-go="questionnaires"><span class="ic">' + ico('form') + '</span><span><b>Questionnaire</b><small>' + (br ? br + ' à terminer' : nf + ' disponible' + (nf > 1 ? 's' : '')) + '</small></span></button></div>';
    var prio = aFaire.slice().sort(function (a, b) { return (enRetard(b) - enRetard(a)) || ((a.date_echeance || '9') < (b.date_echeance || '9') ? -1 : 1); }).slice(0, 4);
    html += '<div class="t-sec"><h2>À déclarer en priorité</h2>' + (aFaire.length > 4 ? '<button data-role-go="R">Tout voir</button>' : '') + '</div>';
    html += prio.length ? '<div class="t-groupe">' + prio.map(ligneTache).join('') + '</div>' : '<div class="t-vide"><div class="ill">' + ico('ok') + '</div><b>Rien à déclarer</b>Toutes vos échéances sont à jour. Tirez l’écran vers le bas pour vérifier les nouveautés.</div>';
    vue.innerHTML = html;
    vue.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { aller(b.dataset.go); }; });
    vue.querySelectorAll('[data-role-go]').forEach(function (b) { b.onclick = function () { etat.role = b.dataset.roleGo; etat.filtre = 'toutes'; aller('taches'); }; });
    brancherLignes(); brancherInstall();
  }

  /* =============== MES TÂCHES : R / A / C / I =============== */
  function ecranTaches() {
    var r = etat.role || 'R', l = listeRole(r), ri = ['R', 'A', 'C', 'I'].indexOf(r);
    var filtres = r === 'R' ? {
      toutes: function () { return true; }, retard: function (t) { return enRetard(t) && !envoiDeTache(t); },
      cours: function (t) { return t.niveau_actuel > 0 && t.niveau_actuel < 100; }, faire: function (t) { return !t.niveau_actuel; }
    } : { toutes: function () { return true; }, retard: enRetard, cours: function (t) { return t.niveau_actuel > 0 && t.niveau_actuel < 100; }, fini: function (t) { return t.niveau_actuel >= 100; } };
    var noms = r === 'R' ? [['toutes', 'Toutes'], ['retard', 'En retard'], ['cours', 'En cours'], ['faire', 'À faire']] : [['toutes', 'Toutes'], ['retard', 'En retard'], ['cours', 'En cours'], ['fini', 'Terminées']];
    if (!filtres[etat.filtre]) etat.filtre = 'toutes';
    var html = enTete('Mes tâches', 'Matrice RACI · ' + (compteRole('R') + compteRole('A') + compteRole('C') + compteRole('I')) + ' opérations') +
      '<div class="t-seg" role="tablist"><span class="curseur" style="transform:translateX(' + (ri * 100) + '%)"></span>' + ['R', 'A', 'C', 'I'].map(function (x) {
        return '<button role="tab" aria-selected="' + (x === r) + '" data-seg="' + x + '" class="' + (x === r ? 'on' : '') + '"><strong>' + x + '</strong><small>' + ROLES[x].nom + '</small>' + (compteRole(x) ? '<i>' + compteRole(x) + '</i>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="t-role"><span class="l r-' + r + '">' + r + '</span><span><b>' + ROLES[r].long + '</b> — ' + ROLES[r].desc + '</span></div>';
    if (!l.length) {
      vue.innerHTML = html + '<div class="t-vide"><div class="ill">' + ico(r === 'R' ? 'ok' : 'tache') + '</div><b>' + (r === 'R' ? 'Aucune échéance à déclarer' : 'Aucune opération pour ce rôle') + '</b>' + (r === 'R' ? 'Tirez l’écran vers le bas pour vérifier les nouveautés.' : 'Vous n’êtes ' + ROLES[r].nom.toLowerCase() + ' sur aucune opération pour le moment.') + '</div>';
      brancherSeg(); return;
    }
    if (l.length > 5) html += '<input class="t-recherche" id="tFiltre" type="search" placeholder="Rechercher une opération, une personne…">';
    html += '<div class="t-onglets">' + noms.map(function (f) { return '<button data-f="' + f[0] + '" class="' + (etat.filtre === f[0] ? 'on' : '') + '">' + f[1] + '<em>' + l.filter(filtres[f[0]]).length + '</em></button>'; }).join('') + '</div>';
    var vis = l.filter(filtres[etat.filtre]);
    html += vis.length ? '<div class="t-groupe" id="tListe">' + vis.map(function (t) { return r === 'R' ? ligneTache(t) : ligneOp(t, r); }).join('') + '</div>' : '<div class="t-vide">Aucune opération dans ce filtre.</div>';
    vue.innerHTML = html;
    brancherLignes(); brancherSeg();
    vue.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { etat.filtre = b.dataset.f; ecranTaches(); }; });
    var f = $('#tFiltre'); if (f) f.oninput = function () { var q = f.value.trim().toLowerCase(); vue.querySelectorAll('#tListe .t-row').forEach(function (b) { b.hidden = q && b.dataset.txt.indexOf(q) < 0; }); };
  }
  function brancherSeg() {
    vue.querySelectorAll('[data-seg]').forEach(function (b) {
      b.onclick = function () {
        var cur = vue.querySelector('.t-seg .curseur'); if (cur) cur.style.transform = 'translateX(' + (['R', 'A', 'C', 'I'].indexOf(b.dataset.seg) * 100) + '%)';
        etat.role = b.dataset.seg; etat.filtre = 'toutes'; setTimeout(ecranTaches, 180);
      };
    });
  }
  function ficheOperation(id, r) {
    var t = listeRole(r).filter(function (x) { return String(x.operation_id) === String(id); })[0]; if (!t) return;
    var liens = etat.paquet.liens || {}, act = '';
    if (r === 'A') act = navigator.onLine && liens.valider ? '<a class="c-btn c-btn-p" href="' + esc(liens.valider.replace('{id}', t.operation_id)) + '">' + ico('ok') + ' Valider les déclarations</a>'
      : '<p class="note">' + ico('wifioff') + ' La validation se fait dans OperaPlus : reconnectez-vous au réseau pour valider.</p>';
    else if (r === 'C') act = '<p class="note">Vous êtes consulté : le responsable peut vous solliciter. Votre avis se donne dans les échanges de l’opération sur OperaPlus.</p>';
    else act = '<p class="note">Vous êtes informé : aucune action n’est attendue. Suivez simplement l’avancement.</p>';
    if (liens.operation && navigator.onLine) act += '<a class="c-btn c-btn-s" href="' + esc(liens.operation.replace('{id}', t.operation_id)) + '">Ouvrir l’opération</a>';
    feuille('<div class="t-fiche-op"><div class="entete">' + miniAnneau(t.niveau_actuel, r) + '<div><h2>' + esc(t.operation_nom) + '</h2><p>' + esc(t.tache_nom || '') + '</p></div></div>' +
      '<dl><div><dt>Avancement</dt><dd class="num">' + Math.round(t.niveau_actuel) + ' %</dd></div><div><dt>Échéance</dt><dd style="' + (enRetard(t) ? 'color:var(--ko)' : '') + '">' + (t.date_echeance ? dateFr(t.date_echeance) : '—') + '</dd></div>' +
      '<div class="w"><dt>Responsable (R)</dt><dd>' + esc(t.responsable || '—') + '</dd></div>' + (r === 'A' ? '<div class="w"><dt>Échéances non déclarées</dt><dd class="num">' + (t.echeances_attente || 0) + '</dd></div>' : '') +
      '<div class="w"><dt>Votre rôle</dt><dd>' + r + ' · ' + ROLES[r].long + '</dd></div></dl><div class="actions">' + act + '<button class="c-btn c-btn-s" data-fermer>Fermer</button></div></div>');
  }

  /* =============== DÉCLARATION =============== */
  function lireGps(cb) {
    if (!navigator.geolocation) return cb(null, 'GPS indisponible sur cet appareil');
    navigator.geolocation.getCurrentPosition(function (p) { cb({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), precision: Math.round(p.coords.accuracy) }); },
      function (e) { cb(null, e.code === 1 ? 'Autorisez la localisation' : 'Position introuvable'); }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 120000 });
  }
  function htmlGps(g, err) {
    return g ? '<div class="t-gps ok">' + ico('gps') + '<span>Position enregistrée (± ' + g.precision + ' m)</span><button type="button" data-gps>Refaire</button></div>'
      : '<div class="t-gps ko">' + ico('gps') + '<span>' + esc(err || 'Recherche de la position…') + '</span><button type="button" data-gps>Réessayer</button></div>';
  }
  function compresser(fichier) {
    var legere = etat.reglages.photos_legeres, max = legere ? 1600 : 2400, q = legere ? 0.75 : 0.88;
    if (!/^image\//.test(fichier.type) || fichier.size < (legere ? 350000 : 1500000)) return Promise.resolve(fichier);
    return new Promise(function (ok) {
      var img = new Image(), url = URL.createObjectURL(fichier);
      img.onload = function () {
        var r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { ok(b && b.size < fichier.size ? b : fichier); }, 'image/jpeg', q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(fichier); };
      img.src = url;
    });
  }
  function ecranDeclaration(id) {
    var t = (etat.paquet.taches || []).filter(function (x) { return String(x.echeance_id) === String(id); })[0];
    if (!t) { vue.innerHTML = enTete('Déclaration', '', 'taches') + '<div class="t-vide"><b>Tâche introuvable</b>Elle a peut-être déjà été déclarée.</div>'; return; }
    var d = etat.decl && etat.decl.id === id ? etat.decl : (etat.decl = { id: id, niveau: Math.round(t.niveau_actuel), commentaire: '', date: aujourdhui(), fichier: null, nom: '', gps: null, err: '' });
    function dessiner() {
      vue.innerHTML = enTete('Déclarer', esc(t.tache_nom || 'Avancement'), 'taches') +
        '<h2 style="font-size:1.35rem;line-height:1.25;margin:.3rem .1rem .3rem">' + esc(t.operation_nom) + '</h2><p style="margin:0 .1rem 1rem;color:var(--mute);font-size:.86rem">' + (t.date_echeance ? 'Échéance ' + dateFr(t.date_echeance) : '') + (enRetard(t) ? ' · <b style="color:var(--ko)">en retard</b>' : '') + '</p>' +
        (envoiDeTache(t) ? '<div class="t-ban or" style="margin:0 0 1rem">' + ico('alerte') + '<span>Une déclaration existe déjà pour cette échéance. Une nouvelle sera envoyée en plus.</span></div>' : '') +
        '<div class="t-bloc"><div class="t-champ"><span class="c-lbl">Niveau atteint <em>*</em></span><div class="t-niv"><b id="dNiv">' + d.niveau + '</b><span>%</span></div>' +
        '<input type="range" min="0" max="100" step="1" value="' + d.niveau + '" id="dRange" aria-label="Niveau atteint"><div class="t-puces">' + [0, 25, 50, 75, 100].map(function (v) { return '<button type="button" data-v="' + v + '" class="' + (d.niveau === v ? 'on' : '') + '">' + v + '</button>'; }).join('') + '</div>' +
        '<small>Avant : ' + t.niveau_actuel + ' %</small></div>' +
        '<label class="t-champ"><span class="c-lbl">Ce qui a été fait <em>*</em></span><textarea class="c-in" id="dCom" placeholder="Ex : 3 séances réalisées à Bafoussam, 120 participants.">' + esc(d.commentaire) + '</textarea></label>' +
        '<label class="t-champ"><span class="c-lbl">Date de réalisation</span><input class="c-in" type="date" id="dDate" value="' + d.date + '" max="' + aujourdhui() + '"></label>' +
        '<div class="t-champ"><span class="c-lbl">Preuve (photo ou document)</span><div class="t-pj"><label>' + ico('cam') + ' Photo<input type="file" accept="image/*" capture="environment" id="dCam"></label><label>' + ico('fichier') + ' Fichier<input type="file" id="dFic"></label></div>' +
        (d.fichier ? '<div class="t-apercu">' + (/^image\//.test(d.fichier.type) ? '<img src="' + URL.createObjectURL(d.fichier) + '" alt="">' : '<span class="ic">' + ico('fichier') + '</span>') + '<div><b>' + esc(d.nom) + '</b>' + taille(d.fichier.size) + '</div><button type="button" id="dX">Retirer</button></div>' : '') + '</div>' +
        '<div class="t-champ"><span class="c-lbl">Localisation</span><div id="dGps">' + htmlGps(d.gps, d.err) + '</div></div>' +
        '<p class="t-err" id="dErr" hidden></p></div>';
      pied.innerHTML = '<div class="t-pied"><div><button class="c-btn c-btn-p" id="dOk">' + ico('ok') + ' Enregistrer la déclaration</button></div></div>';
      var range = $('#dRange');
      function niv(v) { d.niveau = +v; $('#dNiv').textContent = v; range.value = v; vue.querySelectorAll('[data-v]').forEach(function (b) { b.classList.toggle('on', +b.dataset.v === +v); }); }
      range.oninput = function () { niv(range.value); };
      vue.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { niv(b.dataset.v); }; });
      $('#dCom').oninput = function () { d.commentaire = this.value; };
      $('#dDate').onchange = function () { d.date = this.value; };
      [$('#dCam'), $('#dFic')].forEach(function (inp) { inp.onchange = function () { var f = inp.files[0]; if (!f) return; compresser(f).then(function (b) { d.fichier = b; d.nom = f.name.replace(/\.(heic|png)$/i, '.jpg'); dessiner(); }); }; });
      if ($('#dX')) $('#dX').onclick = function () { d.fichier = null; dessiner(); };
      vue.querySelectorAll('[data-gps]').forEach(function (b) { b.onclick = gps; });
      $('#dOk').onclick = function () {
        var err = $('#dErr');
        if (!d.commentaire.trim()) { err.textContent = 'Décrivez ce qui a été fait.'; err.hidden = false; $('#dCom').focus(); return; }
        if (d.date > aujourdhui()) { err.textContent = 'La date ne peut pas être dans le futur.'; err.hidden = false; return; }
        this.disabled = true;
        enregistrerEnvoi({
          uuid: OPT.uuid(), type: 'declaration', titre: t.operation_nom, sous_titre: 'Déclaration · ' + d.niveau + ' %',
          contenu: { operation_id: t.operation_id, echeance_id: t.echeance_id, operation_nom: t.operation_nom, niveau: d.niveau, commentaire: d.commentaire.trim(),
                     date_realisation: d.date, lat: d.gps ? d.gps.lat : '', lon: d.gps ? d.gps.lon : '', precision: d.gps ? d.gps.precision : '',
                     cree_le: new Date().toISOString(), fichier: d.fichier, fichier_nom: d.nom }
        }).then(function () { etat.decl = null; toast(navigator.onLine ? 'Enregistré. Envoi en cours…' : 'Enregistré sur le téléphone. Envoi automatique dès que le réseau est stable.', 4200); aller('accueil'); });
      };
    }
    function gps() { d.gps = null; d.err = ''; var z = $('#dGps'); if (z) z.innerHTML = htmlGps(null); lireGps(function (g, e) { d.gps = g; d.err = e; var z2 = $('#dGps'); if (z2) { z2.innerHTML = htmlGps(g, e); z2.querySelector('[data-gps]').onclick = gps; } }); }
    dessiner();
    if (!d.gps && !d.err) gps();
  }

  /* =============== QUESTIONNAIRES =============== */
  function ecranQuestionnaires() {
    var l = etat.paquet.formulaires || [], br = etat.brouillons.slice().sort(function (a, b) { return b.maj - a.maj; });
    var html = enTete('Questionnaires', l.length + ' disponible' + (l.length > 1 ? 's' : '') + ' · enregistrement automatique', 'accueil');
    if (br.length) html += '<div class="t-sec"><h2>À terminer</h2></div><div class="t-groupe">' + br.map(function (b) {
      return '<button class="t-row" data-br="' + b.uuid + '"><span class="ic" style="background:var(--or-s);color:var(--or)">' + ico('brouillon') + '</span><span class="ct"><b>' + esc(b.titre) + '</b><small>Commencé ' + quand(b.cree_le) + ' · ' + Object.keys(b.reponses).length + ' réponse(s)</small></span><span class="chev">' + ico('chev') + '</span></button>';
    }).join('') + '</div>';
    html += '<div class="t-sec"><h2>Disponibles</h2></div>' + (l.length ? '<div class="t-groupe">' + l.map(function (f) {
      var n = f.questions.filter(function (q) { return q.type !== 'note'; }).length;
      var faits = etat.envois.filter(function (e) { return e.type === 'soumission' && e.contenu.formulaire_id === f.id; }).length;
      return '<button class="t-row" data-f="' + f.id + '"><span class="ic">' + ico('form') + '</span><span class="ct"><b>' + esc(f.titre) + '</b><small>' + (f.description ? esc(f.description) : n + ' questions') + '</small><span class="t-meta"><span class="t-puce v">' + n + ' question' + (n > 1 ? 's' : '') + '</span>' + (faits ? '<span class="t-puce ok">' + faits + ' fiche(s)</span>' : '') + '</span></span><span class="chev">' + ico('chev') + '</span></button>';
    }).join('') + '</div>' : '<div class="t-vide"><div class="ill">' + ico('form') + '</div><b>Aucun questionnaire</b>Votre équipe S&amp;E n’a pas encore publié de questionnaire.</div>');
    vue.innerHTML = html;
    vue.querySelectorAll('[data-br]').forEach(function (b) { b.onclick = function () { aller('remplir/' + b.dataset.br); }; });
    vue.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { nouvelleFiche(+b.dataset.f); }; });
  }
  function nouvelleFiche(fid) {
    var f = (etat.paquet.formulaires || []).filter(function (x) { return x.id === fid; })[0];
    var b = { uuid: OPT.uuid(), formulaire_id: f.id, version: f.version, titre: f.titre, reponses: {}, fichiers: {}, gps: null, page: 0, cree_le: Date.now(), maj: Date.now() };
    DB.mettre('brouillons', b).then(charger).then(function () { aller('remplir/' + b.uuid); });
    lireGps(function (g) { if (g) DB.un('brouillons', b.uuid).then(function (x) { if (x && !x.gps) { x.gps = g; DB.mettre('brouillons', x); } }); });
  }
  function formDe(b) { return (etat.paquet.formulaires || []).filter(function (x) { return x.id === b.formulaire_id; })[0]; }
  function visibles(f, rep) {
    return f.questions.filter(function (q) {
      if (!q.si || !q.si.question) return true;
      var v = rep[q.si.question];
      return Array.isArray(v) ? v.indexOf(q.si.valeur) >= 0 : String(v == null ? '' : v) === String(q.si.valeur);
    });
  }
  function vide(q, b) { if (q.type === 'photo' || q.type === 'signature') return !b.fichiers[q.id]; var v = b.reponses[q.id]; return v == null || v === '' || (Array.isArray(v) && !v.length); }
  function controler(q, b) {
    if (q.type === 'note') return '';
    if (q.obligatoire && vide(q, b)) return 'Cette question est obligatoire.';
    var v = b.reponses[q.id];
    if ((q.type === 'entier' || q.type === 'nombre') && v !== '' && v != null) {
      var n = +v; if (isNaN(n)) return 'Entrez un nombre.';
      if (q.type === 'entier' && Math.round(n) !== n) return 'Entrez un nombre entier.';
      if (q.min !== null && q.min !== '' && q.min !== undefined && n < +q.min) return 'Minimum : ' + q.min + '.';
      if (q.max !== null && q.max !== '' && q.max !== undefined && n > +q.max) return 'Maximum : ' + q.max + '.';
    }
    return '';
  }
  function sauver(b) { b.maj = Date.now(); return DB.mettre('brouillons', b); }

  function ecranQuestion(uid) {
    DB.un('brouillons', uid).then(function (b) {
      if (!b) { aller('questionnaires'); return; }
      var f = formDe(b);
      if (!f) { vue.innerHTML = enTete('Questionnaire', '', 'questionnaires') + '<div class="t-vide"><b>Questionnaire retiré</b>Ce questionnaire n’est plus disponible.<br><br><button class="c-btn c-btn-d" id="qSup">Supprimer ce brouillon</button></div>'; $('#qSup').onclick = function () { DB.oter('brouillons', uid).then(charger).then(function () { aller('questionnaires'); }); }; return; }
      var vis = visibles(f, b.reponses);
      if (b.page >= vis.length) return aller('recap/' + uid);
      var q = vis[b.page], v = b.reponses[q.id];
      var html = enTete(esc(f.titre), 'Question ' + (b.page + 1) + ' sur ' + vis.length, 'questionnaires') +
        '<div class="t-prog"><i><s style="width:' + Math.round(b.page * 100 / vis.length) + '%"></s></i><span>' + Math.round(b.page * 100 / vis.length) + ' %</span></div>' +
        '<div class="t-bloc t-q"><h2>' + esc(q.libelle || 'Question') + (q.obligatoire ? ' <span style="color:var(--ko)">*</span>' : '') + '</h2>' + (q.aide ? '<p class="t-aide">' + esc(q.aide) + '</p>' : '<p class="t-aide"></p>');
      if (q.type === 'texte') html += '<input class="c-in" id="qV" value="' + esc(v || '') + '" autocomplete="off">';
      else if (q.type === 'paragraphe') html += '<textarea class="c-in" id="qV">' + esc(v || '') + '</textarea>';
      else if (q.type === 'entier' || q.type === 'nombre') html += '<input class="c-in" id="qV" type="number" inputmode="' + (q.type === 'entier' ? 'numeric' : 'decimal') + '" step="' + (q.type === 'entier' ? '1' : 'any') + '" value="' + esc(v == null ? '' : v) + '"' + (q.min != null && q.min !== '' ? ' min="' + q.min + '"' : '') + (q.max != null && q.max !== '' ? ' max="' + q.max + '"' : '') + '>';
      else if (q.type === 'date') html += '<input class="c-in" id="qV" type="date" value="' + esc(v || '') + '">';
      else if (q.type === 'choix') html += (q.choix || []).map(function (c) { return '<button type="button" class="t-opt' + (v === c ? ' on' : '') + '" data-c="' + esc(c) + '"><i></i>' + esc(c) + '</button>'; }).join('');
      else if (q.type === 'choix_multiple') html += (q.choix || []).map(function (c) { return '<button type="button" class="t-opt multi' + ((v || []).indexOf(c) >= 0 ? ' on' : '') + '" data-m="' + esc(c) + '"><i></i>' + esc(c) + '</button>'; }).join('') + '<p class="t-aide" style="margin-top:.4rem">Plusieurs réponses possibles.</p>';
      else if (q.type === 'oui_non') html += '<div class="t-on2">' + ['Oui', 'Non'].map(function (c) { return '<button type="button" class="t-opt' + (v === c ? ' on' : '') + '" data-c="' + c + '"><i></i>' + c + '</button>'; }).join('') + '</div>';
      else if (q.type === 'gps') html += '<div id="qGps">' + (v ? htmlGps(v) : '<button type="button" class="c-btn c-btn-l" style="width:100%" data-gps>' + ico('gps') + ' Enregistrer ma position</button>') + '</div>';
      else if (q.type === 'photo') html += '<div class="t-pj"><label>' + ico('cam') + ' Prendre une photo<input type="file" accept="image/*" capture="environment" id="qPh"></label><label>' + ico('photo') + ' Galerie<input type="file" accept="image/*" id="qPh2"></label></div>' + (b.fichiers[q.id] ? '<div class="t-apercu"><img src="' + URL.createObjectURL(b.fichiers[q.id].blob) + '" alt=""><div><b>Photo enregistrée</b>' + taille(b.fichiers[q.id].blob.size) + '</div><button type="button" id="qPhX">Retirer</button></div>' : '');
      else if (q.type === 'signature') html += '<canvas class="t-sign" id="qSig"></canvas><div style="margin-top:.5rem"><button type="button" class="c-btn c-btn-s" id="qSigX" style="min-height:44px">Effacer</button></div>' + (b.fichiers[q.id] ? '<p class="t-aide">Signature déjà enregistrée : signez à nouveau pour la remplacer.</p>' : '');
      html += '<p class="t-err" id="qErr" hidden></p></div>';
      vue.innerHTML = html;
      pied.innerHTML = '<div class="t-pied"><div>' + (b.page > 0 ? '<button class="c-btn c-btn-s" id="qPrec" aria-label="Précédent">' + ico('retour') + '</button>' : '') + '<button class="c-btn c-btn-p" id="qSuiv">' + (b.page === vis.length - 1 ? 'Vérifier' : 'Suivant') + ' ' + ico('fleche') + '</button></div></div>';
      var inp = $('#qV');
      if (inp) { inp.oninput = function () { b.reponses[q.id] = (q.type === 'entier' || q.type === 'nombre') ? (inp.value === '' ? '' : +inp.value) : inp.value; clearTimeout(sauver.t); sauver.t = setTimeout(function () { sauver(b); }, 400); }; if (q.type !== 'date') setTimeout(function () { inp.focus(); }, 50); }
      vue.querySelectorAll('[data-c]').forEach(function (o) { o.onclick = function () { b.reponses[q.id] = o.dataset.c; sauver(b).then(function () { suivant(); }); }; });
      vue.querySelectorAll('[data-m]').forEach(function (o) { o.onclick = function () { var l = b.reponses[q.id] || [], c = o.dataset.m, i = l.indexOf(c); if (i >= 0) l.splice(i, 1); else l.push(c); b.reponses[q.id] = l; o.classList.toggle('on', i < 0); sauver(b); }; });
      var bg = vue.querySelector('[data-gps]');
      if (bg) bg.onclick = function () { $('#qGps').innerHTML = htmlGps(null); lireGps(function (g, e) { if (g) { b.reponses[q.id] = g; sauver(b); } $('#qGps').innerHTML = htmlGps(g, e); var r2 = vue.querySelector('[data-gps]'); if (r2) r2.onclick = bg.onclick; }); };
      ['#qPh', '#qPh2'].forEach(function (s) { var i = $(s); if (i) i.onchange = function () { var fi = i.files[0]; if (!fi) return; compresser(fi).then(function (bl) { b.fichiers[q.id] = { blob: bl, nom: q.id + '.jpg' }; b.reponses[q.id] = true; sauver(b).then(function () { ecranQuestion(uid); }); }); }; });
      if ($('#qPhX')) $('#qPhX').onclick = function () { delete b.fichiers[q.id]; delete b.reponses[q.id]; sauver(b).then(function () { ecranQuestion(uid); }); };
      var sig = $('#qSig'), trace = false;
      if (sig) {
        var ctx, r = window.devicePixelRatio || 1;
        sig.width = sig.clientWidth * r; sig.height = sig.clientHeight * r; ctx = sig.getContext('2d'); ctx.scale(r, r); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#14121F';
        var pos = function (e) { var bb = sig.getBoundingClientRect(); return [e.clientX - bb.left, e.clientY - bb.top]; };
        sig.onpointerdown = function (e) { sig.setPointerCapture(e.pointerId); var p = pos(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); sig.dessin = true; };
        sig.onpointermove = function (e) { if (!sig.dessin) return; var p = pos(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); trace = true; };
        sig.onpointerup = sig.onpointercancel = function () { sig.dessin = false; };
        $('#qSigX').onclick = function () { ctx.clearRect(0, 0, sig.width, sig.height); trace = false; delete b.fichiers[q.id]; delete b.reponses[q.id]; sauver(b); };
      }
      if ($('#qPrec')) $('#qPrec').onclick = function () { b.page = Math.max(0, b.page - 1); sauver(b).then(function () { ecranQuestion(uid); }); };
      function suivant() {
        var aller2 = function () {
          var e = controler(q, b);
          if (e) { var el = $('#qErr'); el.textContent = e; el.hidden = false; return; }
          b.page = b.page + 1; sauver(b).then(function () { ecranQuestion(uid); });
        };
        if (sig && trace) sig.toBlob(function (bl) { b.fichiers[q.id] = { blob: bl, nom: q.id + '.png' }; b.reponses[q.id] = true; aller2(); }, 'image/png');
        else aller2();
      }
      $('#qSuiv').onclick = suivant;
      if (inp) inp.onkeydown = function (e) { if (e.key === 'Enter' && q.type !== 'paragraphe') { e.preventDefault(); suivant(); } };
      window.scrollTo(0, 0);
    });
  }
  function afficherValeur(q, b) {
    if (q.type === 'photo' || q.type === 'signature') return b.fichiers[q.id] ? '<img src="' + URL.createObjectURL(b.fichiers[q.id].blob) + '" alt="">' : '';
    var v = b.reponses[q.id];
    if (v && typeof v === 'object' && !Array.isArray(v)) return esc(v.lat + ', ' + v.lon + ' (± ' + v.precision + ' m)');
    if (Array.isArray(v)) return esc(v.join(', '));
    if (q.type === 'date' && v) return dateFr(v);
    return esc(v == null ? '' : v);
  }
  function ecranRecap(uid) {
    DB.un('brouillons', uid).then(function (b) {
      if (!b) { aller('questionnaires'); return; }
      var f = formDe(b); if (!f) return ecranQuestion(uid);
      var vis = visibles(f, b.reponses).filter(function (q) { return q.type !== 'note'; }), manque = vis.filter(function (q) { return controler(q, b); });
      var gpsKo = f.gps_obligatoire && !b.gps;
      vue.innerHTML = enTete('Vérification', esc(f.titre) + ' · touchez une réponse pour la modifier') +
        '<div class="t-groupe t-recap">' + vis.map(function (q) {
          var i = visibles(f, b.reponses).indexOf(q), val = afficherValeur(q, b), err = controler(q, b);
          return '<button class="t-row" data-p="' + i + '"><span class="ct"><small>' + esc(q.libelle) + '</small><b class="' + (err ? 'manque' : '') + '">' + (err ? esc(err) : (val || '<span style="color:var(--faint)">— sans réponse</span>')) + '</b></span><span class="chev">' + ico('chev') + '</span></button>';
        }).join('') + '</div>' +
        '<div class="t-champ" style="margin-top:1rem"><span class="c-lbl">Localisation de la fiche' + (f.gps_obligatoire ? ' <em>*</em>' : '') + '</span><div id="rGps">' + htmlGps(b.gps, b.gps ? '' : 'Position non enregistrée') + '</div></div>' +
        '<button class="c-btn c-btn-d" id="rSup" style="width:100%;margin-top:.3rem">Abandonner cette fiche</button>';
      pied.innerHTML = '<div class="t-pied"><div><button class="c-btn c-btn-s" id="rRet" aria-label="Revenir aux questions">' + ico('retour') + '</button><button class="c-btn c-btn-p" id="rOk"' + (manque.length || gpsKo ? ' disabled' : '') + '>' + ico('up') + ' Terminer et envoyer</button></div></div>';
      $('#rRet').onclick = function () { b.page = Math.max(0, visibles(f, b.reponses).length - 1); sauver(b).then(function () { aller('remplir/' + uid); }); };
      vue.querySelectorAll('[data-p]').forEach(function (x) { x.onclick = function () { b.page = +x.dataset.p; sauver(b).then(function () { aller('remplir/' + uid); }); }; });
      vue.querySelector('[data-gps]').onclick = function () { $('#rGps').innerHTML = htmlGps(null); lireGps(function (g) { if (g) { b.gps = g; sauver(b); } ecranRecap(uid); }); };
      $('#rSup').onclick = function () { if (confirm('Supprimer définitivement cette fiche non envoyée ?')) DB.oter('brouillons', uid).then(charger).then(function () { aller('questionnaires'); }); };
      $('#rOk').onclick = function () {
        this.disabled = true;
        var donnees = {}, fichiers = [];
        visibles(f, b.reponses).forEach(function (q) {
          if (q.type === 'note') return;
          if (b.fichiers[q.id]) { fichiers.push({ uuid: OPT.uuid(), question: q.id, blob: b.fichiers[q.id].blob, nom: b.fichiers[q.id].nom }); donnees[q.id] = 'fichier'; }
          else if (b.reponses[q.id] !== undefined) donnees[q.id] = b.reponses[q.id];
        });
        enregistrerEnvoi({ uuid: b.uuid, type: 'soumission', titre: f.titre, sous_titre: 'Fiche · ' + Object.keys(donnees).length + ' réponses' + (fichiers.length ? ' · ' + fichiers.length + ' photo(s)' : ''),
          contenu: { formulaire_id: f.id, version: b.version, donnees: donnees, gps: b.gps, cree_le: new Date(b.cree_le).toISOString() }, fichiers: fichiers })
          .then(function () { return DB.oter('brouillons', uid); }).then(charger).then(function () { toast(navigator.onLine ? 'Fiche enregistrée. Envoi en cours…' : 'Fiche enregistrée sur le téléphone. Envoi automatique dès que le réseau est stable.', 4200); aller('accueil'); });
      };
    });
  }

  /* =============== ENVOIS =============== */
  var LIB = {
    en_attente: ['or', 'att', 'Sur le téléphone · attend un réseau stable'], envoi: ['v', 'up', 'Envoi en cours…'], erreur: ['or', 'alerte', 'Échec, nouvel essai automatique'],
    recu_serveur: ['v', 'ok', 'Reçu par OperaPlus'], integre: ['ok', 'ok', 'Intégré dans OperaPlus'], valide: ['ok', 'ok', 'Validé par le S&E'], rejete: ['ko', 'ko', 'Refusé']
  };
  function ligneEnvoi(e) {
    var lb = LIB[e.statut] || LIB.en_attente, coul = { ko: 'var(--ko)', ok: 'var(--ok)', or: 'var(--or)', v: 'var(--v-t)' }[lb[0]];
    return '<div class="t-row" style="cursor:default"><span class="st ' + lb[0] + '">' + ico(lb[1]) + '</span><span class="ct"><b>' + esc(e.titre) + '</b><small>' + esc(e.sous_titre || '') + ' · ' + quand(e.cree_le) + '</small>' +
      '<span class="msg" style="color:' + coul + '">' + lb[2] + (e.message ? '<span style="color:var(--mute);font-weight:500"> — ' + esc(e.message) + '</span>' : '') + '</span>' +
      (e.statut === 'erreur' || e.statut === 'rejete' ? '<span class="act">' + (e.statut === 'erreur' ? '<span data-re="' + e.uuid + '">Réessayer</span>' : '') + '<span data-sup="' + e.uuid + '" style="color:var(--ko)">Retirer du téléphone</span></span>' : '') + '</span></div>';
  }
  function ecranEnvois() {
    var l = etat.envois, att = l.filter(function (e) { return ['en_attente', 'envoi', 'erreur'].indexOf(e.statut) >= 0; }), ok = l.filter(function (e) { return ['recu_serveur', 'integre', 'valide'].indexOf(e.statut) >= 0; }), ko = l.filter(function (e) { return e.statut === 'rejete'; });
    var html = enTete('Envois', 'Dernière synchronisation ' + quand(etat.derniere)) +
      '<div class="t-kpi"><div class="k-or"><b>' + att.length + '</b><small>en attente</small></div><div class="k-ok"><b>' + ok.length + '</b><small>envoyés</small></div><div class="k-ko"><b>' + ko.length + '</b><small>refusés</small></div></div>';
    if (att.length) html += '<button class="c-btn c-btn-n" data-sync style="margin-bottom:.4rem">' + ico('up') + ' Envoyer maintenant</button>';
    if (!l.length) html += '<div class="t-vide"><div class="ill">' + ico('up') + '</div><b>Aucun envoi</b>Vos déclarations et fiches apparaîtront ici, avec leur état.</div>';
    [['À envoyer', att], ['Refusés', ko], ['Envoyés', ok]].forEach(function (g) { if (g[1].length) html += '<div class="t-sec"><h2>' + g[0] + '</h2></div><div class="t-groupe">' + g[1].map(ligneEnvoi).join('') + '</div>'; });
    vue.innerHTML = html;
    vue.querySelectorAll('[data-re]').forEach(function (b) { b.onclick = function () { DB.un('envois', b.dataset.re).then(function (e) { e.statut = 'en_attente'; e.prochain = 0; return DB.mettre('envois', e); }).then(charger).then(function () { synchroniser(true); }); }; });
    vue.querySelectorAll('[data-sup]').forEach(function (b) { b.onclick = function () { if (confirm('Retirer cet envoi du téléphone ?')) DB.oter('envois', b.dataset.sup).then(charger).then(ecranEnvois); }; });
  }

  /* =============== PROFIL =============== */
  function ligne(id, icone, libelle, sous, val, rouge, lien) {
    var ouv = lien ? '<a href="' + esc(lien) + '"' : '<button type="button"', ferm = lien ? '</a>' : '</button>';
    return ouv + (id ? ' id="' + id + '"' : '') + (rouge ? ' class="rouge"' : '') + '><span class="ic">' + ico(icone) + '</span><span class="lb">' + libelle + (sous ? '<small>' + sous + '</small>' : '') + '</span>' + (val ? '<span class="val">' + val + '</span>' : '') + (rouge ? '' : '<span class="ch">' + ico('chev') + '</span>') + ferm;
  }
  function ecranProfil() {
    var att = attente();
    vue.innerHTML = '<section class="t-hero profil"><svg class="deco" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="148"/><circle cx="150" cy="150" r="110" class="a"/><circle cx="150" cy="150" r="72"/></svg>' +
      '<div class="t-hero-top"><span class="date">Mon profil</span>' + puceSync() + '</div>' +
      '<div class="t-avatar">' + esc(initiales(C.nom)) + '</div><b>' + esc(C.nom) + '</b><small>' + esc(C.email || 'Agent terrain') + '</small>' + (C.institution ? '<small>' + esc(C.institution) + '</small>' : '') +
      '<div class="roles">' + ['R', 'A', 'C', 'I'].map(function (r) { return '<span><i>' + r + '</i>' + compteRole(r) + '</span>'; }).join('') + '</div></section>' +
      '<div style="height:1.1rem"></div><div class="t-liste">' +
      ligne('pEnv', 'up', 'Mes envois', att ? att + ' en attente' : 'Tout est envoyé', '', false) +
      ligne('pQ', 'form', 'Questionnaires', etat.brouillons.length ? etat.brouillons.length + ' à terminer' : 'Remplir une fiche', '', false) +
      ligne('pReg', 'reglage', 'Paramètres', 'Apparence, synchronisation, photos', '', false) +
      (etat.installer ? ligne('tInst2', 'install', 'Installer l’application', 'Sur l’écran d’accueil du téléphone', '', false) : '') +
      '</div><div class="t-liste">' +
      ligne('pAide', 'aide', 'Aide et présentation', 'Revoir comment fonctionne l’appli', '', false) +
      (C.bureau ? ligne('', 'bureau', 'Espace bureau', 'Questionnaires et données reçues', '', false, C.bureau) : '') +
      ligne('', 'maison', 'Retour à OperaPlus', '', '', false, '/') +
      ligne('pOut', 'sortie', 'Se déconnecter', '', '', true) +
      '</div><p style="text-align:center;font-size:.78rem;color:var(--faint);margin:1.2rem 0">OperaPlus Terrain · v' + esc(C.version) + '</p>';
    $('#pEnv').onclick = function () { aller('envois'); };
    $('#pQ').onclick = function () { aller('questionnaires'); };
    $('#pReg').onclick = function () { aller('parametres'); };
    $('#pAide').onclick = function () { decouverte(true); };
    $('#pOut').onclick = function () {
      var a = attente() + etat.brouillons.length;
      if (a && !confirm(a + ' saisie(s) ne sont pas encore envoyées. Elles resteront sur ce téléphone et partiront à la prochaine connexion. Se déconnecter quand même ?')) return;
      if (!navigator.onLine) return toast('Pas de réseau : reconnectez-vous au réseau pour vous déconnecter.');
      $('#tLogout').submit();
    };
    brancherInstall();
  }

  /* =============== PARAMÈTRES =============== */
  function inter(id, on) { return '<label class="t-inter"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span></span></label>'; }
  function ecranParametres() {
    var p = etat.paquet, finis = etat.envois.filter(function (e) { return OPT.FINAUX.indexOf(e.statut) >= 0; }).length;
    var th = lireTheme(), mode = th.mode || 'auto', coul = th.couleur || 'violet';
    vue.innerHTML = enTete('Paramètres', '', 'profil') +
      '<p class="t-titre-liste">Apparence</p><div class="t-liste"><div class="t-modes">' + [['clair', 'Clair'], ['sombre', 'Sombre'], ['auto', 'Automatique']].map(function (m) {
        return '<button data-mode="' + m[0] + '" class="' + m[0] + (mode === m[0] ? ' on' : '') + '" aria-pressed="' + (mode === m[0]) + '"><span class="mini"><i></i><i></i><i></i></span>' + m[1] + '</button>';
      }).join('') + '</div><div class="t-teintes">' + TEINTES.map(function (c) {
        return '<button data-teinte="' + c[0] + '" class="' + (coul === c[0] ? 'on' : '') + '" style="background:' + c[1] + ';color:' + c[1] + '" aria-label="' + c[2] + '" title="' + c[2] + '"><svg viewBox="0 0 24 24" style="stroke:#fff"><path d="M20 6L9 17l-5-5"/></svg></button>';
      }).join('') + '<span>Couleur principale · « Automatique » suit le réglage du téléphone</span></div></div>' +
      '<p class="t-titre-liste">Synchronisation</p><div class="t-liste">' +
      '<div><span class="ic">' + ico('wifi') + '</span><span class="lb">Envoi automatique<small>Dès que le réseau est stable</small></span>' + inter('sAuto', etat.reglages.sync_auto) + '</div>' +
      ligne('sMaj', 'sync', 'Mettre à jour mes tâches', 'et les questionnaires', p ? quand(Date.parse(p.genere_le)) : 'jamais', false) + '</div>' +
      '<p class="t-titre-liste">Photos</p><div class="t-liste">' +
      '<div><span class="ic">' + ico('photo') + '</span><span class="lb">Photos légères<small>Économise le forfait internet (recommandé)</small></span>' + inter('sPhoto', etat.reglages.photos_legeres) + '</div></div>' +
      '<p class="t-titre-liste">Stockage sur le téléphone</p><div class="t-liste">' +
      '<div><span class="ic">' + ico('stock') + '</span><span class="lb">Espace utilisé</span><span class="val" id="sEsp">…</span></div>' +
      ligne('sVider', 'corbeille', 'Retirer les envois terminés', finis + ' envoi' + (finis > 1 ? 's' : '') + ' intégré' + (finis > 1 ? 's' : '') + ' ou refusé' + (finis > 1 ? 's' : ''), '', false) + '</div>' +
      '<div class="t-ban info" style="margin:0 0 1rem">' + ico('alerte') + '<span>Vos saisies restent sur ce téléphone tant qu’elles ne sont pas envoyées. Ne videz pas les données du navigateur avant que l’onglet Envois soit à jour.</span></div>';
    vue.querySelectorAll('[data-mode]').forEach(function (b) { b.onclick = function () { choisirTheme({ mode: b.dataset.mode }); ecranParametres(); }; });
    vue.querySelectorAll('[data-teinte]').forEach(function (b) { b.onclick = function () { choisirTheme({ couleur: b.dataset.teinte }); ecranParametres(); }; });
    $('#sAuto').onchange = function () { reglage('sync_auto', this.checked).then(function () { toast(etat.reglages.sync_auto ? 'Envoi automatique activé.' : 'Envoi automatique désactivé : touchez la puce « À jour » pour envoyer.'); }); };
    $('#sPhoto').onchange = function () { reglage('photos_legeres', this.checked); };
    $('#sMaj').onclick = function () { if (!navigator.onLine) return toast('Pas de réseau.'); toast('Mise à jour…'); actualiserPaquet().then(function () { toast('Tâches et questionnaires à jour.'); ecranParametres(); }); };
    $('#sVider').onclick = function () {
      if (!finis) return toast('Rien à retirer.');
      Promise.all(etat.envois.filter(function (e) { return OPT.FINAUX.indexOf(e.statut) >= 0; }).map(function (e) { return DB.oter('envois', e.uuid); })).then(charger).then(function () { toast('Envois terminés retirés.'); ecranParametres(); });
    };
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { var x = $('#sEsp'); if (x) x.textContent = taille(e.usage || 0); });
  }

  /* =============== découverte (première ouverture) =============== */
  var ETAPES = [
    { t: 'Bienvenue sur <span>OperaPlus Terrain</span>', p: 'Déclarez l’avancement de vos tâches et remplissez vos questionnaires directement sur le terrain.', b: [['b1', 'ok'], ['b2', 'form']] },
    { t: 'Travaillez <span>sans réseau</span>', p: 'Au village, en brousse ou dans un centre de santé : tout ce que vous saisissez est gardé sur le téléphone.', b: [['b1', 'wifioff']] },
    { t: 'Tout part <span>tout seul</span>', p: 'Dès que le réseau est stable, vos saisies partent vers OperaPlus. La puce en haut de l’écran indique leur état.', b: [['b1', 'up'], ['b3', 'ok']] },
    { t: 'Chacun <span>son rôle</span>', p: 'R réalise, A valide, C donne son avis, I est informé : vos tâches sont rangées selon votre rôle.', b: [['b1', 'tache'], ['b2', 'gps']] }
  ];
  function decouverte(revoir) {
    var i = 0;
    function dessiner() {
      var e = ETAPES[i], der = i === ETAPES.length - 1;
      couche.innerHTML = '<div class="t-decouv" role="dialog" aria-modal="true"><div class="haut">' + (i ? '<button class="t-retour" id="oPrec" aria-label="Précédent">' + ico('retour') + '</button>' : '<span class="c-logo" style="width:44px;height:44px">' + LOGO + '</span>') +
        (der ? '<span></span>' : '<button class="passer" id="oPasser">Passer</button>') + '</div><div class="corps">' +
        '<div class="t-ill" aria-hidden="true"><span class="orb"></span><span class="orb b"></span><span class="orb c"></span><div class="tel"><i></i><i></i><i></i><i style="width:70%"></i></div>' + e.b.map(function (b) { return '<span class="bul ' + b[0] + '">' + ico(b[1]) + '</span>'; }).join('') + '</div>' +
        '<h1>' + e.t + '</h1><p>' + e.p + '</p><div class="t-points">' + ETAPES.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div></div>' +
        '<div class="bas"><button class="c-btn c-btn-p" id="oSuiv">' + (der ? 'Commencer' : i === 0 ? 'Découvrir' : 'Suivant') + ' ' + ico('fleche') + '</button></div></div>';
      $('#oSuiv').onclick = function () { if (der) fin(); else { i++; dessiner(); } };
      if ($('#oPrec')) $('#oPrec').onclick = function () { i--; dessiner(); };
      if ($('#oPasser')) $('#oPasser').onclick = fin;
    }
    function fin() { couche.innerHTML = ''; DB.ecrire('decouverte_vue', true); router(); }
    dessiner();
  }

  /* =============== installation & service worker =============== */
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); etat.installer = e; if (ecranRafraichissable()) router(true); });
  function brancherInstall() {
    ['#tInst1', '#tInst2'].forEach(function (s) { var b = $(s); if (b) b.onclick = function () { etat.installer.prompt(); etat.installer.userChoice.finally(function () { etat.installer = null; router(); }); }; });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(C.sw, { scope: R }).then(function (reg) {
      if (reg.periodicSync) navigator.permissions && navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (s) { if (s.state === 'granted') reg.periodicSync.register('op-envois', { minInterval: 3600000 }).catch(function () {}); }).catch(function () {});
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'synchro') charger().then(function () { if (ecranRafraichissable()) router(true); }); });
  }

  /* =============== démarrage =============== */
  var debut = Date.now();
  Promise.all([chargerReglages(), charger(), DB.lire('decouverte_vue')]).then(function (r) {
    if (etat.reglages.theme && !localStorage.getItem('op-terrain-theme')) { try { localStorage.setItem('op-terrain-theme', JSON.stringify(etat.reglages.theme)); } catch (e) {} }
    appliquerTheme(lireTheme());
    setTimeout(function () {
      var s = $('#tSplash'); s.classList.add('fin'); setTimeout(function () { s.remove(); }, 400);
      router();
      if (!r[2]) decouverte(false);
    }, Math.max(0, 900 - (Date.now() - debut)));
    if (navigator.onLine) actualiserPaquet().then(charger).then(function () { if (ecranRafraichissable()) router(true); synchroniser(false); });
  });
})();
