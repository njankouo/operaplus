/* OperaPlus Terrain — interface (charte violette). Données et synchronisation : sync.js */
(function () {
  'use strict';
  var C = window.OP_CONF, R = C.racine, DB = OPT.DB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var vue = $('#tVue'), pied = $('#tPied'), couche = $('#tCouche');
  var etat = { paquet: null, envois: [], brouillons: [], synchro: false, installer: null, decl: null, reglages: { sync_auto: true, photos_legeres: true }, filtre: 'toutes' };

  /* ---------------- utilitaires ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(t, ms) { var b = $('#tToast'); b.innerHTML = '<div>' + esc(t) + '</div>'; clearTimeout(toast.m); toast.m = setTimeout(function () { b.innerHTML = ''; }, ms || 3500); }
  function csrf() { var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/); return m ? decodeURIComponent(m[1]) : C.csrf; }
  function aujourdhui() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function dateFr(iso) { if (!iso) return ''; var p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function quand(ms) {
    if (!ms) return 'jamais'; var s = (Date.now() - ms) / 1000;
    if (s < 60) return 'à l’instant'; if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h'; return 'le ' + new Date(ms).toLocaleDateString('fr-FR');
  }
  function taille(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' Ko' : (n / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
  function initiales(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (m) { return m[0]; }).join('').toUpperCase(); }
  var ICO = {
    ok: '<path d="M20 6L9 17l-5-5"/>', ko: '<path d="M18 6L6 18M6 6l12 12"/>', att: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    up: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>', alerte: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>', tache: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    chev: '<path d="M9 18l6-6-6-6"/>', retour: '<path d="M15 18l-6-6 6-6"/>', cam: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    fichier: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', gps: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    brouillon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M12 20h.01"/>',
    wifioff: '<path d="M2 2l20 20M8.5 16.1a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5.2-2.8M19 12.6a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
    reglage: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', aide: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    bureau: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>', stock: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', maison: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    corbeille: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', install: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'
  };
  function ico(n) { return '<svg viewBox="0 0 24 24">' + (ICO[n] || '') + '</svg>'; }

  /* ---------------- réglages ---------------- */
  function chargerReglages() { return DB.lire('reglages').then(function (r) { if (r) Object.assign(etat.reglages, r); }); }
  function reglage(k, v) { etat.reglages[k] = v; return DB.ecrire('reglages', etat.reglages); }

  /* ---------------- état réseau et en-tête ---------------- */
  function salut() { var h = new Date().getHours(); return (h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir') + ', ' + (C.prenom || C.nom) + ' 👋'; }
  function attente() { return etat.envois.filter(function (x) { return x.statut === 'en_attente' || x.statut === 'erreur' || x.statut === 'envoi'; }).length; }
  function majEtat() {
    var n = attente();
    $('#tDot').className = 't-dot' + (etat.synchro ? ' sync' : (navigator.onLine ? '' : ' off'));
    $('#tEtat').textContent = etat.synchro ? 'Envoi en cours…' : (navigator.onLine ? 'En ligne' : 'Hors ligne · tout est gardé') + (n ? ' · ' + n + ' à envoyer' : '');
    $('#tSync').classList.toggle('tourne', etat.synchro);
    $('#tNb').textContent = n || ''; $('#tNb2').textContent = n || '';
  }
  function banniere(type, html) { var b = $('#tBanniere'); if (!html) { b.hidden = true; return; } b.className = 't-ban ' + type; b.innerHTML = html; b.hidden = false; }

  /* ---------------- données locales ---------------- */
  function charger() {
    return Promise.all([DB.lire('paquet'), DB.tout('envois'), DB.tout('brouillons')]).then(function (r) {
      etat.paquet = r[0] || null; etat.envois = (r[1] || []).sort(function (a, b) { return b.cree_le - a.cree_le; }); etat.brouillons = r[2] || [];
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
    banniere('ko', ico('alerte') + '<span>Votre session a expiré. Vos données sont en sécurité sur le téléphone. <a href="' + esc(C.login) + '">Se reconnecter</a> (avec du réseau) pour les envoyer.</span>');
  }
  function enregistrerEnvoi(e) {
    e.statut = 'en_attente'; e.cree_le = Date.now(); e.essais = 0;
    return DB.mettre('envois', e).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(function (reg) { if (reg.sync) reg.sync.register('op-envois').catch(function () {}); });
      return charger();
    }).then(function () { if (etat.reglages.sync_auto) setTimeout(function () { synchroniser(false, true); }, 400); });
  }

  /* ---------------- synchronisation ---------------- */
  function synchroniser(manuel, discret) {
    if (etat.synchro) return Promise.resolve();
    if (!manuel && !etat.reglages.sync_auto) return Promise.resolve();
    if (!navigator.onLine) { if (manuel) toast('Pas de réseau. Vos données restent sur le téléphone et partiront automatiquement.'); return Promise.resolve(); }
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
        else if (b.erreurs) toast(b.erreurs + ' envoi(s) en erreur : voir l’onglet Envois.');
        else if (manuel) toast('Tout est à jour.');
      });
    }).catch(function () { if (manuel) toast('La synchronisation a échoué. Nouvel essai plus tard.'); })
      .finally(function () { etat.synchro = false; return OPT.nettoyer(30).then(charger).then(function () { if (ecranRafraichissable()) router(); }); });
  }
  function ecranRafraichissable() {
    if (couche.innerHTML) return false;
    var h = location.hash.slice(1).split('/')[0] || 'accueil';
    return ['accueil', 'taches', 'envois', 'profil', 'parametres', 'questionnaires'].indexOf(h) >= 0;
  }

  window.addEventListener('online', function () { majEtat(); setTimeout(function () { synchroniser(false); }, 3000); });
  window.addEventListener('offline', majEtat);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') synchroniser(false); });
  setInterval(function () {
    var a = etat.envois.some(function (x) { return x.statut === 'en_attente' || x.statut === 'erreur'; });
    if (navigator.onLine && a) synchroniser(false);
  }, 90000);
  $('#tSync').addEventListener('click', function () { synchroniser(true); });

  /* ---------------- navigation ---------------- */
  function aller(h) { if (location.hash === '#' + h) router(); else location.hash = h; }
  window.addEventListener('hashchange', router);
  $('#tNav').addEventListener('click', function (e) { var b = e.target.closest('[data-route]'); if (b) aller(b.dataset.route); });
  function onglet(n) { document.querySelectorAll('#tNav [data-route]').forEach(function (b) { b.classList.toggle('on', b.dataset.route === n); }); }
  function router() {
    var p = (location.hash.slice(1) || 'accueil').split('/');
    pied.innerHTML = ''; window.scrollTo(0, 0);
    $('#tSalut').textContent = p[0] === 'accueil' ? salut() : 'OperaPlus Terrain';
    onglet({ declarer: 'taches', remplir: 'accueil', recap: 'accueil', questionnaires: 'accueil', parametres: 'profil' }[p[0]] || p[0]);
    if (!etat.paquet && ['profil', 'parametres', 'envois'].indexOf(p[0]) < 0) return ecranSansPaquet();
    if (p[0] === 'declarer') return ecranDeclaration(p[1]);
    if (p[0] === 'remplir') return ecranQuestion(p[1]);
    if (p[0] === 'recap') return ecranRecap(p[1]);
    ({ accueil: ecranAccueil, taches: ecranTaches, questionnaires: ecranQuestionnaires, envois: ecranEnvois, profil: ecranProfil, parametres: ecranParametres }[p[0]] || ecranAccueil)();
  }
  function retour(libelle, cible) { return '<button class="t-retour" data-retour="' + (cible || '') + '" aria-label="' + esc(libelle || 'Retour') + '">' + ico('retour') + '</button>'; }
  vue.addEventListener('click', function (e) { var b = e.target.closest('[data-retour]'); if (b) aller(b.dataset.retour || 'accueil'); });
  function ecranSansPaquet() {
    vue.innerHTML = '<div class="t-vide" style="margin-top:1rem"><div class="ill">' + ico('wifi') + '</div><b>Première ouverture</b>Ouvrez l’application une fois avec du réseau pour télécharger vos tâches et questionnaires. Ensuite, elle fonctionne sans réseau.<br><br><button class="c-btn c-btn-p" id="tCharger">Télécharger maintenant</button></div>';
    $('#tCharger').onclick = function () { toast('Téléchargement…'); actualiserPaquet().then(function () { if (!etat.paquet) toast('Impossible : vérifiez le réseau.'); router(); }); };
  }

  /* ---------------- bouton + ---------------- */
  function feuille(html) {
    couche.innerHTML = '<div class="t-voile" id="tVoile"><div class="t-feuille" role="dialog" aria-modal="true"><div class="poignee"></div>' + html + '</div></div>';
    $('#tVoile').onclick = function (e) { if (e.target.id === 'tVoile' || e.target.closest('[data-fermer]')) couche.innerHTML = ''; };
  }
  $('#tPlus').addEventListener('click', function () {
    var nt = etat.paquet ? (etat.paquet.taches || []).length : 0, nf = etat.paquet ? (etat.paquet.formulaires || []).length : 0;
    feuille('<h2>Nouvelle saisie</h2>' +
      '<button class="t-carte" data-go="taches"><span class="t-ic">' + ico('tache') + '</span><span class="t-ct"><b>Déclarer un avancement</b><small>' + nt + ' échéance' + (nt > 1 ? 's' : '') + ' à déclarer</small></span><span class="t-chev">' + ico('chev') + '</span></button>' +
      '<button class="t-carte" data-go="questionnaires"><span class="t-ic" style="background:var(--or-s);color:var(--or)">' + ico('form') + '</span><span class="t-ct"><b>Remplir un questionnaire</b><small>' + nf + ' questionnaire' + (nf > 1 ? 's' : '') + ' disponible' + (nf > 1 ? 's' : '') + '</small></span><span class="t-chev">' + ico('chev') + '</span></button>' +
      '<button class="c-btn c-btn-s" data-fermer style="width:100%;margin-top:.3rem">Annuler</button>');
    couche.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { couche.innerHTML = ''; aller(b.dataset.go); }; });
  });

  /* ---------------- ACCUEIL ---------------- */
  function envoiDeTache(t) { return etat.envois.filter(function (e) { return e.type === 'declaration' && String(e.contenu.echeance_id) === String(t.echeance_id) && e.statut !== 'rejete'; })[0]; }
  function puceTache(t) {
    var env = envoiDeTache(t);
    if (env) return env.statut === 'integre' || env.statut === 'valide' ? '<span class="t-puce ok">Envoyée</span>' : (env.statut === 'recu_serveur' ? '<span class="t-puce v">Reçue, en traitement</span>' : '<span class="t-puce or">En attente d’envoi</span>');
    if (t.date_echeance && t.date_echeance < aujourdhui()) return '<span class="t-puce ko">En retard · ' + dateFr(t.date_echeance) + '</span>';
    if (t.niveau_actuel >= 100) return '<span class="t-puce ok">Terminée</span>';
    if (t.niveau_actuel > 0) return '<span class="t-puce or">En cours' + (t.date_echeance ? ' · ' + dateFr(t.date_echeance) : '') + '</span>';
    return '<span class="t-puce">À faire' + (t.date_echeance ? ' · ' + dateFr(t.date_echeance) : '') + '</span>';
  }
  function carteTache(t) {
    return '<button class="t-carte" data-decl="' + t.echeance_id + '" data-txt="' + esc((t.operation_nom + ' ' + t.tache_nom).toLowerCase()) + '"><span class="t-ic">' + ico('tache') + '</span><span class="t-ct"><b>' + esc(t.operation_nom) + '</b>' +
      (t.tache_nom ? '<small>' + esc(t.tache_nom) + '</small>' : '') + '<span class="t-mini"><span class="t-barre"><s style="width:' + Math.min(100, t.niveau_actuel) + '%"></s></span><em>' + Math.round(t.niveau_actuel) + ' %</em></span>' + puceTache(t) + '</span><span class="t-chev">' + ico('chev') + '</span></button>';
  }
  function brancherTaches() { vue.querySelectorAll('[data-decl]').forEach(function (b) { b.onclick = function () { aller('declarer/' + b.dataset.decl); }; }); }
  function ecranAccueil() {
    var l = etat.paquet.taches || [], auj = aujourdhui();
    var moy = l.length ? Math.round(l.reduce(function (s, t) { return s + Math.min(100, t.niveau_actuel); }, 0) / l.length) : 100;
    var retard = l.filter(function (t) { return t.date_echeance && t.date_echeance < auj && !envoiDeTache(t); }).length;
    var circ = 2 * Math.PI * 30, nf = (etat.paquet.formulaires || []).length, br = etat.brouillons.length, att = attente();
    var html = '';
    if (etat.installer) html += '<div class="t-ban info" style="margin:0 0 1rem">' + ico('install') + '<span>Installez l’application sur ce téléphone pour l’ouvrir comme une appli. <button id="tInst1">Installer</button></span></div>';
    html += '<div class="t-prog-carte"><div class="tx"><small>Avancement moyen de mes tâches</small><b>' + moy + ' %</b><span>' + l.length + ' échéance' + (l.length > 1 ? 's' : '') + ' à déclarer' + (retard ? ' · ' + retard + ' en retard' : '') + '</span></div>' +
      '<div class="t-anneau"><svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="30" stroke="rgba(255,255,255,.22)"/><circle cx="38" cy="38" r="30" stroke="#fff" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - moy / 100)).toFixed(1) + '"/></svg><em>' + moy + '%</em></div></div>';
    html += '<div class="t-raccourcis"><button data-go="taches"><span class="ic">' + ico('tache') + '</span><b>Déclarer un avancement</b><small>' + l.length + ' à faire</small></button>' +
      '<button data-go="questionnaires"><span class="ic" style="background:var(--or-s);color:var(--or)">' + ico('form') + '</span><b>Remplir un questionnaire</b><small>' + (br ? br + ' à terminer' : nf + ' disponible' + (nf > 1 ? 's' : '')) + '</small></button></div>';
    if (att) html += '<button class="t-carte" data-go="envois" style="background:var(--or-s);box-shadow:none"><span class="t-ic" style="background:#fff;color:var(--or)">' + ico('up') + '</span><span class="t-ct"><b>' + att + ' saisie' + (att > 1 ? 's' : '') + ' à envoyer</b><small>Envoi automatique dès que le réseau est stable</small></span><span class="t-chev">' + ico('chev') + '</span></button>';
    html += '<div class="t-sec"><h2>Mes tâches</h2>' + (l.length > 3 ? '<button data-go="taches">Voir tout</button>' : '') + '</div>';
    html += l.length ? l.slice(0, 3).map(carteTache).join('') : '<div class="t-vide"><div class="ill">' + ico('ok') + '</div><b>Aucune échéance en attente</b>Bravo ! Touchez ↻ en haut pour vérifier les nouveautés.</div>';
    vue.innerHTML = html;
    vue.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { aller(b.dataset.go); }; });
    brancherTaches(); brancherInstall();
  }

  /* ---------------- MES TÂCHES ---------------- */
  function ecranTaches() {
    var l = etat.paquet.taches || [], auj = aujourdhui();
    var filtres = {
      toutes: function () { return true; }, retard: function (t) { return t.date_echeance && t.date_echeance < auj && !envoiDeTache(t); },
      cours: function (t) { return t.niveau_actuel > 0 && t.niveau_actuel < 100; }, faire: function (t) { return !t.niveau_actuel; }
    };
    var html = retour('Accueil', 'accueil') + '<h1>Mes tâches</h1><p class="t-sub">' + l.length + ' échéance' + (l.length > 1 ? 's' : '') + ' à déclarer · mises à jour ' + quand(Date.parse(etat.paquet.genere_le)) + '</p>';
    if (!l.length) { vue.innerHTML = html + '<div class="t-vide"><div class="ill">' + ico('ok') + '</div><b>Aucune échéance en attente</b>Touchez ↻ en haut pour vérifier les nouveautés.</div>'; return; }
    if (l.length > 5) html += '<input class="t-recherche" id="tFiltre" type="search" placeholder="Rechercher une opération…">';
    html += '<div class="t-onglets">' + [['toutes', 'Toutes'], ['retard', 'En retard'], ['cours', 'En cours'], ['faire', 'À faire']].map(function (f) {
      return '<button data-f="' + f[0] + '" class="' + (etat.filtre === f[0] ? 'on' : '') + '">' + f[1] + ' · ' + l.filter(filtres[f[0]]).length + '</button>';
    }).join('') + '</div>';
    var vis = l.filter(filtres[etat.filtre] || filtres.toutes);
    html += '<div id="tListe">' + (vis.length ? vis.map(carteTache).join('') : '<div class="t-vide">Aucune tâche dans ce filtre.</div>') + '</div>';
    vue.innerHTML = html;
    brancherTaches();
    vue.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { etat.filtre = b.dataset.f; ecranTaches(); }; });
    var f = $('#tFiltre'); if (f) f.oninput = function () { var q = f.value.trim().toLowerCase(); vue.querySelectorAll('[data-decl]').forEach(function (b) { b.hidden = q && b.dataset.txt.indexOf(q) < 0; }); };
  }

  /* ---------------- DÉCLARATION ---------------- */
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
    if (!t) { vue.innerHTML = retour('Tâches', 'taches') + '<div class="t-vide"><b>Tâche introuvable</b>Elle a peut-être déjà été déclarée.</div>'; return; }
    var d = etat.decl && etat.decl.id === id ? etat.decl : (etat.decl = { id: id, niveau: Math.round(t.niveau_actuel), commentaire: '', date: aujourdhui(), fichier: null, nom: '', gps: null, err: '' });
    function dessiner() {
      vue.innerHTML = retour('Tâches', 'taches') + '<h1>' + esc(t.operation_nom) + '</h1><p class="t-sub">' + esc(t.tache_nom || '') + (t.date_echeance ? ' · échéance ' + dateFr(t.date_echeance) : '') + '</p>' +
        (envoiDeTache(t) ? '<div class="t-ban or" style="margin:0 0 1rem">' + ico('alerte') + '<span>Une déclaration existe déjà pour cette échéance. Une nouvelle sera envoyée en plus.</span></div>' : '') +
        '<div class="t-bloc"><div class="t-champ"><span class="c-lbl">Niveau atteint <em>*</em></span><div class="t-niv"><b id="dNiv">' + d.niveau + '</b><span>%</span></div>' +
        '<input type="range" min="0" max="100" step="1" value="' + d.niveau + '" id="dRange" aria-label="Niveau atteint"><div class="t-puces">' + [0, 25, 50, 75, 100].map(function (v) { return '<button type="button" data-v="' + v + '" class="' + (d.niveau === v ? 'on' : '') + '">' + v + '</button>'; }).join('') + '</div>' +
        '<small>Avant : ' + t.niveau_actuel + ' %</small></div>' +
        '<label class="t-champ"><span class="c-lbl">Ce qui a été fait <em>*</em></span><textarea class="c-in" id="dCom" placeholder="Ex : 3 séances réalisées à Bafoussam, 120 participants.">' + esc(d.commentaire) + '</textarea></label>' +
        '<label class="t-champ"><span class="c-lbl">Date de réalisation</span><input class="c-in" type="date" id="dDate" value="' + d.date + '" max="' + aujourdhui() + '"></label>' +
        '<div class="t-champ"><span class="c-lbl">Preuve (photo ou document)</span><div class="t-pj"><label>' + ico('cam') + ' Photo<input type="file" accept="image/*" capture="environment" id="dCam"></label><label>' + ico('fichier') + ' Fichier<input type="file" id="dFic"></label></div>' +
        (d.fichier ? '<div class="t-apercu">' + (/^image\//.test(d.fichier.type) ? '<img src="' + URL.createObjectURL(d.fichier) + '" alt="">' : '<span class="t-ic">' + ico('fichier') + '</span>') + '<div><b>' + esc(d.nom) + '</b>' + taille(d.fichier.size) + '</div><button type="button" id="dX">Retirer</button></div>' : '') + '</div>' +
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
        }).then(function () { etat.decl = null; toast(navigator.onLine ? 'Enregistré. Envoi en cours…' : 'Enregistré sur le téléphone. Envoi automatique dès que le réseau est stable.', 4500); aller('accueil'); });
      };
    }
    function gps() { d.gps = null; d.err = ''; var z = $('#dGps'); if (z) z.innerHTML = htmlGps(null); lireGps(function (g, e) { d.gps = g; d.err = e; var z2 = $('#dGps'); if (z2) { z2.innerHTML = htmlGps(g, e); z2.querySelector('[data-gps]').onclick = gps; } }); }
    dessiner();
    if (!d.gps && !d.err) gps();
  }

  /* ---------------- QUESTIONNAIRES ---------------- */
  function ecranQuestionnaires() {
    var l = etat.paquet.formulaires || [], br = etat.brouillons.slice().sort(function (a, b) { return b.maj - a.maj; });
    var html = retour('Accueil', 'accueil') + '<h1>Questionnaires</h1><p class="t-sub">Touchez un questionnaire pour remplir une nouvelle fiche. Tout est enregistré au fur et à mesure.</p>';
    if (br.length) html += '<div class="t-sec"><h2>À terminer</h2></div>' + br.map(function (b) {
      return '<button class="t-carte" data-br="' + b.uuid + '"><span class="t-ic" style="background:var(--or-s);color:var(--or)">' + ico('brouillon') + '</span><span class="t-ct"><b>' + esc(b.titre) + '</b><small>Commencé ' + quand(b.cree_le) + '</small><span class="t-puce or">' + Object.keys(b.reponses).length + ' réponse(s)</span></span><span class="t-chev">' + ico('chev') + '</span></button>';
    }).join('');
    html += '<div class="t-sec"><h2>Disponibles</h2></div>' + (l.length ? l.map(function (f) {
      var n = f.questions.filter(function (q) { return q.type !== 'note'; }).length;
      var faits = etat.envois.filter(function (e) { return e.type === 'soumission' && e.contenu.formulaire_id === f.id; }).length;
      return '<button class="t-carte" data-f="' + f.id + '"><span class="t-ic">' + ico('form') + '</span><span class="t-ct"><b>' + esc(f.titre) + '</b>' + (f.description ? '<small>' + esc(f.description) + '</small>' : '') + '<span class="t-puce v">' + n + ' question' + (n > 1 ? 's' : '') + '</span>' + (faits ? ' <span class="t-puce ok">' + faits + ' fiche(s)</span>' : '') + '</span><span class="t-chev">' + ico('chev') + '</span></button>';
    }).join('') : '<div class="t-vide"><div class="ill">' + ico('form') + '</div><b>Aucun questionnaire</b>Votre équipe S&amp;E n’a pas encore publié de questionnaire.</div>');
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
      if (!f) { vue.innerHTML = retour('Questionnaires', 'questionnaires') + '<div class="t-vide"><b>Questionnaire retiré</b>Ce questionnaire n’est plus disponible. <br><br><button class="c-btn c-btn-d" id="qSup">Supprimer ce brouillon</button></div>'; $('#qSup').onclick = function () { DB.oter('brouillons', uid).then(charger).then(function () { aller('questionnaires'); }); }; return; }
      var vis = visibles(f, b.reponses);
      if (b.page >= vis.length) return aller('recap/' + uid);
      var q = vis[b.page], v = b.reponses[q.id];
      var html = retour(f.titre, 'questionnaires') + '<p class="t-sub" style="margin-bottom:.6rem">' + esc(f.titre) + '</p>' +
        '<div class="t-prog"><i><s style="width:' + Math.round((b.page) * 100 / vis.length) + '%"></s></i><span>' + (b.page + 1) + ' / ' + vis.length + '</span></div>' +
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
      pied.innerHTML = '<div class="t-pied"><div>' + (b.page > 0 ? '<button class="c-btn c-btn-s" id="qPrec" aria-label="Précédent">' + ico('retour') + '</button>' : '') + '<button class="c-btn c-btn-p" id="qSuiv">' + (b.page === vis.length - 1 ? 'Vérifier' : 'Suivant') + ' ' + ico('chev') + '</button></div></div>';
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
        sig.width = sig.clientWidth * r; sig.height = sig.clientHeight * r; ctx = sig.getContext('2d'); ctx.scale(r, r); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#14132B';
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
      vue.innerHTML = '<button class="t-retour" id="rRet" aria-label="Questions">' + ico('retour') + '</button><h1>Vérifiez avant l’envoi</h1><p class="t-sub">' + esc(f.titre) + ' · touchez une réponse pour la modifier.</p>' +
        '<div class="t-recap">' + vis.map(function (q) {
          var i = visibles(f, b.reponses).indexOf(q), val = afficherValeur(q, b), err = controler(q, b);
          return '<button data-p="' + i + '"><div><small>' + esc(q.libelle) + '</small><b class="' + (err ? 'manque' : '') + '">' + (err ? esc(err) : (val || '<span style="color:#A9A8BE">— sans réponse</span>')) + '</b></div><span style="color:#C3C2D4">' + ico('chev') + '</span></button>';
        }).join('') + '</div>' +
        '<div class="t-champ" style="margin-top:1rem"><span class="c-lbl">Localisation de la fiche' + (f.gps_obligatoire ? ' <em>*</em>' : '') + '</span><div id="rGps">' + htmlGps(b.gps, b.gps ? '' : 'Position non enregistrée') + '</div></div>' +
        '<button class="c-btn c-btn-d" id="rSup" style="width:100%;margin-top:.3rem">Abandonner cette fiche</button>';
      pied.innerHTML = '<div class="t-pied"><div><button class="c-btn c-btn-p" id="rOk"' + (manque.length || gpsKo ? ' disabled' : '') + '>' + ico('up') + ' Terminer et envoyer</button></div></div>';
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
          .then(function () { return DB.oter('brouillons', uid); }).then(charger).then(function () { toast(navigator.onLine ? 'Fiche enregistrée. Envoi en cours…' : 'Fiche enregistrée sur le téléphone. Envoi automatique dès que le réseau est stable.', 4500); aller('accueil'); });
      };
    });
  }

  /* ---------------- ENVOIS ---------------- */
  var LIB = {
    en_attente: ['or', 'att', 'Sur le téléphone · en attente de réseau stable'], envoi: ['v', 'up', 'Envoi en cours…'], erreur: ['or', 'alerte', 'Échec, nouvel essai automatique'],
    recu_serveur: ['v', 'ok', 'Reçu par OperaPlus'], integre: ['ok', 'ok', 'Intégré dans OperaPlus'], valide: ['ok', 'ok', 'Validé par le S&E'], rejete: ['ko', 'ko', 'Refusé']
  };
  function ecranEnvois() {
    var l = etat.envois, att = attente();
    var html = '<h1>Envois</h1><p class="t-sub">Dernière synchronisation : <span id="eDer">…</span></p>' +
      '<div class="t-kpi"><div><b>' + att + '</b><small>en attente</small></div><div><b>' + l.filter(function (e) { return ['recu_serveur', 'integre', 'valide'].indexOf(e.statut) >= 0; }).length + '</b><small>envoyés</small></div><div><b>' + l.filter(function (e) { return e.statut === 'rejete'; }).length + '</b><small>refusés</small></div></div>';
    if (att) html += '<button class="c-btn c-btn-p" id="eGo" style="margin-bottom:1rem">' + ico('up') + ' Envoyer maintenant</button>';
    html += l.length ? l.map(function (e) {
      var lb = LIB[e.statut] || LIB.en_attente, coul = lb[0] === 'ko' ? 'var(--ko)' : lb[0] === 'ok' ? 'var(--ok)' : lb[0] === 'or' ? 'var(--or)' : 'var(--v)';
      return '<div class="t-env ' + lb[0] + '"><span class="t-ic">' + ico(lb[1]) + '</span><div><b>' + esc(e.titre) + '</b><small>' + esc(e.sous_titre || '') + ' · ' + quand(e.cree_le) + '</small><p style="color:' + coul + '"><b style="display:inline;font-size:.8rem;color:inherit">' + lb[2] + '</b>' + (e.message ? '<span style="color:var(--mute)"> — ' + esc(e.message) + '</span>' : '') + '</p>' +
        (e.statut === 'erreur' || e.statut === 'rejete' ? '<div class="t-act">' + (e.statut === 'erreur' ? '<button data-re="' + e.uuid + '">Réessayer</button>' : '') + '<button data-sup="' + e.uuid + '" style="color:var(--ko)">Retirer du téléphone</button></div>' : '') + '</div></div>';
    }).join('') : '<div class="t-vide"><div class="ill">' + ico('up') + '</div><b>Aucun envoi</b>Vos déclarations et fiches apparaîtront ici, avec leur état.</div>';
    vue.innerHTML = html;
    DB.lire('derniere_synchro').then(function (t) { var x = $('#eDer'); if (x) x.textContent = quand(t); });
    if ($('#eGo')) $('#eGo').onclick = function () { synchroniser(true); };
    vue.querySelectorAll('[data-re]').forEach(function (b) { b.onclick = function () { DB.un('envois', b.dataset.re).then(function (e) { e.statut = 'en_attente'; e.prochain = 0; return DB.mettre('envois', e); }).then(charger).then(function () { synchroniser(true); }); }; });
    vue.querySelectorAll('[data-sup]').forEach(function (b) { b.onclick = function () { if (confirm('Retirer cet envoi du téléphone ?')) DB.oter('envois', b.dataset.sup).then(charger).then(ecranEnvois); }; });
  }

  /* ---------------- PROFIL ---------------- */
  function ligne(id, icone, libelle, sous, val, rouge, lien) {
    var ouv = lien ? '<a href="' + esc(lien) + '"' : '<button type="button"', ferm = lien ? '</a>' : '</button>';
    return ouv + (id ? ' id="' + id + '"' : '') + (rouge ? ' class="rouge"' : '') + '><span class="ic">' + ico(icone) + '</span><span class="lb">' + libelle + (sous ? '<small>' + sous + '</small>' : '') + '</span>' + (val ? '<span class="val">' + val + '</span>' : '') + (rouge ? '' : '<span class="ch">' + ico('chev') + '</span>') + ferm;
  }
  function ecranProfil() {
    var att = attente();
    vue.innerHTML = '<div class="t-profil"><div class="t-avatar">' + esc(initiales(C.nom)) + '</div><b>' + esc(C.nom) + '</b><small>' + esc(C.email || C.institution || 'Agent terrain') + '</small>' + (C.email && C.institution ? '<small>' + esc(C.institution) + '</small>' : '') + '</div>' +
      '<div class="t-liste">' +
      ligne('pEnv', 'up', 'Mes envois', att ? att + ' en attente' : 'Tout est envoyé', '', false) +
      ligne('pQ', 'form', 'Questionnaires', etat.brouillons.length ? etat.brouillons.length + ' à terminer' : 'Remplir une fiche', '', false) +
      ligne('pReg', 'reglage', 'Paramètres', 'Synchronisation, photos, stockage', '', false) +
      (etat.installer ? ligne('tInst2', 'install', 'Installer l’application', 'Sur l’écran d’accueil du téléphone', '', false) : '') +
      '</div><div class="t-liste">' +
      ligne('pAide', 'aide', 'Aide et présentation', 'Revoir comment fonctionne l’appli', '', false) +
      (C.bureau ? ligne('', 'bureau', 'Espace bureau', 'Questionnaires et données reçues', '', false, C.bureau) : '') +
      ligne('', 'maison', 'Retour à OperaPlus', '', '', false, '/') +
      ligne('pOut', 'sortie', 'Se déconnecter', '', '', true) +
      '</div><p class="t-sub" style="text-align:center">OperaPlus Terrain · v' + esc(C.version) + '</p>';
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

  /* ---------------- PARAMÈTRES ---------------- */
  function inter(id, on) { return '<label class="t-inter"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span></span></label>'; }
  function ecranParametres() {
    var p = etat.paquet, finis = etat.envois.filter(function (e) { return OPT.FINAUX.indexOf(e.statut) >= 0; }).length;
    vue.innerHTML = retour('Profil', 'profil') + '<h1>Paramètres</h1>' +
      '<p class="t-titre-liste">Synchronisation</p><div class="t-liste">' +
      '<div><span class="ic">' + ico('wifi') + '</span><span class="lb">Envoi automatique<small>Dès que le réseau est stable</small></span>' + inter('sAuto', etat.reglages.sync_auto) + '</div>' +
      ligne('sMaj', 'att', 'Mettre à jour mes tâches', 'et les questionnaires', p ? quand(Date.parse(p.genere_le)) : 'jamais', false) +
      '<div><span class="ic">' + ico('ok') + '</span><span class="lb">Dernière synchronisation</span><span class="val" id="sSyn">…</span></div></div>' +
      '<p class="t-titre-liste">Photos</p><div class="t-liste">' +
      '<div><span class="ic">' + ico('photo') + '</span><span class="lb">Photos légères<small>Économise le forfait internet (recommandé)</small></span>' + inter('sPhoto', etat.reglages.photos_legeres) + '</div></div>' +
      '<p class="t-titre-liste">Stockage sur le téléphone</p><div class="t-liste">' +
      '<div><span class="ic">' + ico('stock') + '</span><span class="lb">Espace utilisé</span><span class="val" id="sEsp">…</span></div>' +
      ligne('sVider', 'corbeille', 'Retirer les envois terminés', finis + ' envoi' + (finis > 1 ? 's' : '') + ' intégré' + (finis > 1 ? 's' : '') + ' ou refusé' + (finis > 1 ? 's' : ''), '', false) + '</div>' +
      '<div class="t-ban info" style="margin:0">' + ico('alerte') + '<span>Vos saisies restent sur ce téléphone tant qu’elles ne sont pas envoyées. Ne videz pas les données du navigateur avant que l’onglet Envois soit à jour.</span></div>';
    $('#sAuto').onchange = function () { reglage('sync_auto', this.checked).then(function () { toast(etat.reglages.sync_auto ? 'Envoi automatique activé.' : 'Envoi automatique désactivé : utilisez le bouton ↻.'); }); };
    $('#sPhoto').onchange = function () { reglage('photos_legeres', this.checked); };
    $('#sMaj').onclick = function () { if (!navigator.onLine) return toast('Pas de réseau.'); toast('Mise à jour…'); actualiserPaquet().then(function () { toast('Tâches et questionnaires à jour.'); ecranParametres(); }); };
    $('#sVider').onclick = function () {
      if (!finis) return toast('Rien à retirer.');
      Promise.all(etat.envois.filter(function (e) { return OPT.FINAUX.indexOf(e.statut) >= 0; }).map(function (e) { return DB.oter('envois', e.uuid); })).then(charger).then(function () { toast('Envois terminés retirés.'); ecranParametres(); });
    };
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { var x = $('#sEsp'); if (x) x.textContent = taille(e.usage || 0); });
    DB.lire('derniere_synchro').then(function (t) { var x = $('#sSyn'); if (x) x.textContent = quand(t); });
  }

  /* ---------------- bienvenue + découverte (première ouverture) ---------------- */
  var ETAPES = [
    { t: 'Bienvenue sur <span>OperaPlus Terrain</span>', p: 'Déclarez l’avancement de vos tâches et remplissez vos questionnaires directement sur le terrain.', b: [['b1', 'ok'], ['b2', 'form']] },
    { t: 'Travaillez <span>sans réseau</span>', p: 'Au village, en brousse ou dans un centre de santé : tout ce que vous saisissez est gardé sur le téléphone.', b: [['b1', 'wifioff']] },
    { t: 'Tout part <span>tout seul</span>', p: 'Dès que le réseau est stable, vos saisies sont envoyées à OperaPlus. Vous suivez leur état dans « Envois ».', b: [['b1', 'up'], ['b3', 'ok']] },
    { t: 'Des preuves <span>fiables</span>', p: 'Photo, position GPS et signature accompagnent vos déclarations : votre travail est reconnu.', b: [['b1', 'cam'], ['b2', 'gps']] }
  ];
  function decouverte(revoir) {
    var i = 0;
    function dessiner() {
      var e = ETAPES[i], der = i === ETAPES.length - 1;
      couche.innerHTML = '<div class="t-decouv" role="dialog" aria-modal="true"><div class="haut">' + (i ? '<button class="t-retour" id="oPrec" style="margin:0" aria-label="Précédent">' + ico('retour') + '</button>' : '<span class="c-logo" style="width:40px;height:40px;border-radius:12px"><i></i></span>') +
        (der ? '<span></span>' : '<button class="passer" id="oPasser">Passer</button>') + '</div><div class="corps">' +
        '<div class="t-ill" aria-hidden="true"><div class="tel"><i></i><i></i><i></i><i style="width:70%"></i></div>' + e.b.map(function (b) { return '<span class="bul ' + b[0] + '">' + ico(b[1]) + '</span>'; }).join('') + '</div>' +
        '<h1>' + e.t + '</h1><p>' + e.p + '</p><div class="t-points">' + ETAPES.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div></div>' +
        '<div class="bas">' + (der ? '<button class="c-btn c-btn-p" id="oSuiv">Commencer</button>' : '<span></span><button class="c-btn c-btn-p" id="oSuiv" style="width:auto;padding:0 1.8rem">' + (i === 0 ? 'Découvrir' : 'Suivant') + ' ' + ico('chev') + '</button>') + '</div></div>';
      $('#oSuiv').onclick = function () { if (der) fin(); else { i++; dessiner(); } };
      if ($('#oPrec')) $('#oPrec').onclick = function () { i--; dessiner(); };
      if ($('#oPasser')) $('#oPasser').onclick = fin;
    }
    function fin() { couche.innerHTML = ''; DB.ecrire('decouverte_vue', true); router(); }
    dessiner();
  }

  /* ---------------- installation & service worker ---------------- */
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); etat.installer = e; if (ecranRafraichissable()) router(); });
  function brancherInstall() {
    ['#tInst1', '#tInst2'].forEach(function (s) { var b = $(s); if (b) b.onclick = function () { etat.installer.prompt(); etat.installer.userChoice.finally(function () { etat.installer = null; router(); }); }; });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(C.sw, { scope: R }).then(function (reg) {
      if (reg.periodicSync) navigator.permissions && navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (s) { if (s.state === 'granted') reg.periodicSync.register('op-envois', { minInterval: 3600000 }).catch(function () {}); }).catch(function () {});
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'synchro') charger().then(function () { if (ecranRafraichissable()) router(); }); });
  }

  /* ---------------- démarrage ---------------- */
  var debut = Date.now();
  Promise.all([chargerReglages(), charger(), DB.lire('decouverte_vue')]).then(function (r) {
    setTimeout(function () {
      var s = $('#tSplash'); s.classList.add('fin'); setTimeout(function () { s.remove(); }, 400);
      router();
      if (!r[2]) decouverte(false);
    }, Math.max(0, 900 - (Date.now() - debut)));
    if (navigator.onLine) actualiserPaquet().then(charger).then(function () { if (ecranRafraichissable()) router(); synchroniser(false); });
  });
})();
