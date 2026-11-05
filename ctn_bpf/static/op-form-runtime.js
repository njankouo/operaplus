/*!
 * OperaPlus · moteur de saisie des formulaires (op-form-runtime.js)
 * À inclure sur la page de SAISIE (là où le formulaire conçu dans le designer est affiché) :
 *   <script src="{% static 'operaplus/op-form-runtime.js' %}" defer></script>
 * Il lit les règles posées dans le designer (attributs data-op-*) et les applique pendant la collecte :
 *   validation par champ, cohérence entre champs, alertes de valeurs inhabituelles, « non applicable »,
 *   totaux calculés, questions conditionnelles, sections et pages sur mobile, brouillon hors-ligne, GPS.
 * Aucun champ n'est renommé : les valeurs partent toujours sous les noms D0elt<ID> attendus par le serveur.
 */
(function () {
  'use strict';
  var CSS = [
    '.opf-err{display:block;margin-top:4px;font-size:12px;font-weight:700;color:#C2410C}',
    '.opf-warn{display:block;margin-top:4px;font-size:12px;font-weight:700;color:#B45309}',
    '.opf-bad{border-color:#E35A33!important;box-shadow:0 0 0 3px rgba(227,90,51,.15)!important}',
    '.opf-soft{border-color:#E48B0C!important;box-shadow:0 0 0 3px rgba(228,139,12,.15)!important}',
    '.opf-calc{background:#F2F4F7!important;color:#0b1220!important;cursor:not-allowed}',
    '.opf-na{display:inline-flex;align-items:center;gap:4px;margin-left:6px;font-size:12px;font-weight:700;color:#667085;cursor:pointer;user-select:none;white-space:nowrap}',
    '.opf-na input{width:15px;height:15px}',
    '.opf-isna{opacity:.45}',
    '.opf-hidden{display:none!important}',
    '.opf-req::after{content:" *";color:#E35A33;font-weight:800}',
    '.opf-sum{margin:14px 0;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.5}',
    '.opf-sum.bad{background:#FFF3EF;border:1px solid #FFC4B2;color:#9E351C}',
    '.opf-sum.warn{background:#FFF8EB;border:1px solid #FDD98A;color:#8F520B}',
    '.opf-sum ul{margin:6px 0 0;padding-left:18px}',
    '.opf-sum label{display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:700}',
    '.opf-steps{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}',
    '.opf-steps button{border:1px solid #E4E8EE;background:#fff;border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:700;color:#475467;cursor:pointer}',
    '.opf-steps button.on{background:#123A37;border-color:#123A37;color:#fff}',
    '.opf-steps button.done{border-color:#2A8A7D;color:#2A8A7D}',
    '.opf-steps button.on.done{color:#fff}',
    '.opf-nav{display:flex;justify-content:space-between;gap:10px;margin-top:16px}',
    '.opf-nav button{height:44px;padding:0 18px;border-radius:12px;border:1px solid #E4E8EE;background:#fff;font-weight:800;font-size:14px;cursor:pointer}',
    '.opf-nav button.next{background:#123A37;color:#fff;border-color:#123A37}',
    '.opf-draft{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:0 0 14px;padding:10px 14px;border-radius:12px;background:#EEF7F5;border:1px solid #ABDBD2;color:#123A37;font-size:13px;font-weight:700}',
    '.opf-draft button{border:0;border-radius:9px;padding:6px 12px;font-weight:800;cursor:pointer}',
    '.opf-draft .y{background:#123A37;color:#fff}.opf-draft .n{background:transparent;color:#123A37}',
    '.opf-saved{position:fixed;right:14px;bottom:14px;z-index:9999;padding:6px 12px;border-radius:999px;background:#0F1B2D;color:#fff;font-size:12px;font-weight:700;opacity:0;transition:opacity .3s}',
    '.opf-saved.on{opacity:.9}',
    '.opf-gps{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.opf-gps button{border:1px solid #123A37;background:#fff;color:#123A37;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;cursor:pointer}',
    '.opf-gps span{font-size:12.5px;font-weight:700;color:#2A8A7D}',
    '.opf-unit{display:inline-block;margin-left:6px;font-size:12px;font-weight:700;color:#667085;vertical-align:middle}',
    '.opf-multi{display:flex;flex-wrap:wrap;gap:6px}',
    '.opf-multi label{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #E4E8EE;border-radius:999px;background:#fff;font-size:13px;font-weight:600;color:#344054;cursor:pointer;user-select:none}',
    '.opf-multi label:has(input:checked){border-color:#2B3A67;background:#EEF1F8;color:#2B3A67}',
    '.opf-multi input{width:15px;height:15px;margin:0}',
    '.opf-file{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border:1px dashed #C9D3DC;border-radius:12px;background:#FAFBFC;min-width:240px}',
    '.opf-file.has{border-style:solid;border-color:#ABDBD2;background:#F3FAF8}',
    '.opf-file.bad{border-color:#E5484D;background:#FFF5F5}',
    '.opf-file .pick{display:inline-flex;align-items:center;gap:6px;border:1px solid #123A37;background:#fff;color:#123A37;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;cursor:pointer}',
    '.opf-file .pick:focus-visible{outline:2px solid #E48B0C;outline-offset:2px}',
    '.opf-file .thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid #E4E8EE;background:#fff}',
    '.opf-file .ico{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #E4E8EE;font-size:11px;font-weight:800;color:#123A37;text-transform:uppercase}',
    '.opf-file .info{display:flex;flex-direction:column;min-width:0;flex:1}',
    '.opf-file .info b{font-size:13px;color:#0F1B2D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}',
    '.opf-file .info small{font-size:12px;color:#667085}',
    '.opf-file .act{display:flex;gap:6px}',
    '.opf-file .act a,.opf-file .act button{border:0;background:transparent;color:#123A37;font-weight:700;font-size:12.5px;cursor:pointer;text-decoration:underline;padding:4px}',
    '.opf-file .act .rm{color:#B42318}',
    '.opf-file .bar{height:4px;border-radius:4px;background:#E4E8EE;overflow:hidden;width:100%}',
    '.opf-file .bar i{display:block;height:100%;width:0;background:#2A8A7D;transition:width .15s}',
    '@media print{.opf-file .pick,.opf-file .act{display:none}}',
    '.opf-opts{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;border:0;min-width:0}',
    '.opf-opts label{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:6px 12px 6px 9px;border:1px solid #D0D5DD;border-radius:8px;background:#fff;font-size:13.5px;font-weight:600;color:#344054;cursor:pointer;user-select:none}',
    '.opf-opts label:has(input:checked){border-color:#123A37;background:#EEF4F2;color:#123A37}',
    '.opf-opts label:has(input:focus-visible){outline:2px solid #E48B0C;outline-offset:2px}',
    '.opf-opts input{width:16px;height:16px;margin:0;accent-color:#123A37}',
    '.opf-opts .c{font:600 11px ui-monospace,monospace;color:#98A2B3}',
    '.opf-opts.dis{opacity:.45;pointer-events:none}',
    '.opf-opts-n{display:block;margin-top:4px;font-size:11.5px;color:#667085}',
    '.opf-now{margin-left:6px;border:1px solid #D0D5DD;background:#fff;color:#123A37;border-radius:8px;padding:6px 10px;font-weight:700;font-size:12.5px;cursor:pointer;vertical-align:middle}',
    '.opf-file .picks{display:flex;gap:6px;flex-wrap:wrap}',
    '.opf-file.drag{border-color:#123A37;background:#EEF4F2}',
    '.opf-xhide{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}',
    '.opf-geo{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.opf-geo button{border:1px solid #2A8A7D;background:#fff;color:#1F6F65;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap}',
    '.opf-geo small{font-size:12px;font-weight:600;color:#667085}',
    '@media (max-width:760px){.op-page-wrap>*{max-width:100%}}'
  ].join('\n');

  function onReady(f) { if (document.readyState !== 'loading') f(); else document.addEventListener('DOMContentLoaded', f); }
  function num(v) { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); }
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('fr-FR'); }
  function labelOf(el) {
    var l = el.getAttribute('data-op-label') || el.getAttribute('title'); if (l) return l;
    var tr = el.closest && el.closest('tr'), td = tr && tr.cells[0]; if (td && !td.contains(el)) { var t = td.textContent.replace(/\s+/g, ' ').trim(); if (t) return t; }
    return el.name;
  }

  function OperaForm(root, opts) {
    this.root = root; this.opts = opts || {}; this._h = [];
    this.form = root.tagName === 'FORM' ? root : root.closest('form') || root;
    this.fields = [].slice.call(root.querySelectorAll('input[name^="D0elt"], select[name^="D0elt"], textarea[name^="D0elt"]'));
    if (!this.fields.length) return;
    this.byName = {}; var self = this;
    this.fields.forEach(function (f) { self.byName[f.name] = f; });
    this.rules = [];
    root.querySelectorAll('.op-rules[data-rules]').forEach(function (d) { try { self.rules = self.rules.concat(JSON.parse(d.getAttribute('data-rules')) || []); } catch (e) {} d.style.display = 'none'; });
    this.setupFields(); this.setupTypes(); this.setupNA(); this.setupCalc(); this.setupConditions(); this.setupPages(); this.setupGPS();
    if (this.opts.draft !== false) this.setupDraft();
    var onEdit = function (e) { if (e.target.name && e.target.name.indexOf('D0elt') === 0) { self.recalc(); self.conditions(); self.check(e.target); self.saveDraftSoon(); } };
    this.on(root, 'input', onEdit); this.on(root, 'change', onEdit);
    if (this.opts.submit !== false) this.on(this.form, 'submit', function (e) { if (!self.validateAll(true)) { e.preventDefault(); e.stopImmediatePropagation(); } else self.clearDraft(); }, true);
    this.recalc(); this.conditions();
  }
  var P = OperaForm.prototype;
  /* écouteurs mémorisés : permet de réinitialiser le moteur quand le formulaire est rechargé dans le même conteneur */
  P.on = function (t, type, fn, cap) { t.addEventListener(type, fn, !!cap); this._h.push([t, type, fn, !!cap]); };
  P.destroy = function () { (this._h || []).forEach(function (h) { h[0].removeEventListener(h[1], h[2], h[3]); }); this._h = []; if (this.savedEl) this.savedEl.remove(); };
  /* liste des points à corriger / à vérifier, sans rien afficher */
  P.collect = function () {
    var self = this, errs = [], warns = [], first = null;
    this.fields.forEach(function (f) {
      var r = self.fieldIssues(f);
      if (r.err) { errs.push({ f: f, text: labelOf(f) + ' : ' + r.err }); first = first || f; } else if (r.warn) warns.push({ f: f, text: labelOf(f) + ' : ' + r.warn });
    });
    this.ruleIssues().forEach(function (i) { var f = self.byName[i.fields[0]] || null; (i.level === 'warn' ? warns : errs).push({ f: f, text: i.text }); if (i.level !== 'warn') first = first || f; });
    return { errs: errs, warns: warns, first: first };
  };

  /* ---------- 1. validation par champ ---------- */
  P.setupFields = function () {
    this.fields.forEach(function (f) {
      if (f.hasAttribute('data-op-required')) { f.required = true; var l = f.closest('tr') ? f.closest('tr').querySelector('td,th') : null; if (l && !l.contains(f)) l.classList.add('opf-req'); }
      if (f.getAttribute('data-op-min') !== null && f.type === 'number') f.min = f.getAttribute('data-op-min');
      if (f.getAttribute('data-op-max') !== null && f.type === 'number') f.max = f.getAttribute('data-op-max');
      if (f.hasAttribute('data-op-int') && f.type === 'number') f.step = '1'; else if (f.type === 'number' && !f.step) f.step = 'any';
      if (f.value === '0' && f.hasAttribute('data-op-required') && f.hasAttribute('data-op-empty')) f.value = '';
    });
  };
  /* ---------- 1 bis. types de champ (designer : data-op-type) ---------- */
  function typ(f) { return f.getAttribute('data-op-type') || ''; }
  function choices(f) { return String(f.getAttribute('data-op-choices') || '').split(';').map(function (x) { var m = x.split('='); return m.length > 1 ? [m[0].trim(), m.slice(1).join('=').trim()] : null; }).filter(Boolean); }
  P.setupTypes = function () {
    var self = this;
    this.fields.forEach(function (f) {
      var t = typ(f), u = f.getAttribute('data-op-unit');
      if (u && !(f.nextElementSibling && f.nextElementSibling.classList.contains('opf-unit'))) { var s = document.createElement('span'); s.className = 'opf-unit'; s.textContent = u; f.insertAdjacentElement('afterend', s); }
      if (t === 'tel') { f.setAttribute('inputmode', 'tel'); f.setAttribute('autocomplete', 'tel'); }
      if (t === 'email') { f.setAttribute('inputmode', 'email'); f.setAttribute('autocomplete', 'email'); }
      if (f.tagName === 'SELECT' && !f._opts && !f.hasAttribute('data-op-liste')) self.setupOptions(f, 'radio');
      if ((t === 'time' || t === 'date' || f.type === 'time' || f.type === 'date') && !f._now && !f.readOnly) {
        var nb = document.createElement('button'); nb.type = 'button'; nb.className = 'opf-now';
        var heure = t === 'time' || f.type === 'time';
        nb.textContent = heure ? 'Maintenant' : 'Aujourd’hui'; nb.setAttribute('aria-label', (heure ? 'Mettre l’heure actuelle dans ' : 'Mettre la date du jour dans ') + labelOf(f));
        nb.addEventListener('click', function () {
          var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
          f.value = heure ? z(d.getHours()) + ':' + z(d.getMinutes()) : d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
          f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
        });
        if (heure && f.type !== 'time' && (!f.value || /^\d{1,2}:\d{2}$/.test(f.value))) { try { f.type = 'time'; } catch (e) {} }
        if (heure) f.step = f.step || '60';
        (f.nextElementSibling && f.nextElementSibling.classList.contains('opf-unit') ? f.nextElementSibling : f).insertAdjacentElement('afterend', nb); f._now = nb;
      }
      if (t === 'multi' && !f._opts) self.setupOptions(f, 'checkbox');
      if ((t === 'file' || t === 'photo') && !f._fichier) self.setupFichier(f, t);
      if (t === 'gps' && !f._geo) {
        var w = document.createElement('span'); w.className = 'opf-geo';
        var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Capturer la position';
        var info = document.createElement('small'); w.appendChild(b); w.appendChild(info);
        f.insertAdjacentElement('afterend', w); f._geo = w;
        b.addEventListener('click', function () {
          if (!navigator.geolocation) { info.textContent = 'GPS indisponible : saisissez « latitude, longitude ».'; return; }
          info.textContent = 'Recherche de la position…'; b.disabled = true;
          navigator.geolocation.getCurrentPosition(function (pos) {
            b.disabled = false; f.value = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
            info.textContent = 'Précision ± ' + Math.round(pos.coords.accuracy) + ' m'; f.dispatchEvent(new Event('input', { bubbles: true }));
          }, function () { b.disabled = false; info.textContent = 'Position refusée ou introuvable : saisissez-la à la main.'; }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        });
      }
    });
    this.syncTypes();
  };

  /* ---------- 1 quater. listes de choix affichées en cases ----------
     Choix unique (select : liste, oui/non, échelle) → boutons radio, 7 options au plus (au-delà : liste déroulante d'origine).
     Choix multiples (texte « 1;3 ») → cases à cocher ; une option « Aucun / Ne sait pas » est exclusive.
     Le champ D0elt d'origine reste le porteur de la valeur : rien ne change pour l'enregistrement. */
  var UID = 0;
  P.setupOptions = function (f, kind) {
    var self = this, radio = kind === 'radio';
    var opts = radio ? [].slice.call(f.options).filter(function (o) { return o.value !== ''; }).map(function (o) { return [o.value, o.textContent.trim()]; }) : choices(f);
    if (!opts.length || (radio && opts.length > 7)) return;
    var box = document.createElement('fieldset'), nom = 'opf-' + (++UID) + '-' + f.name, n = null;
    box.className = 'opf-opts ' + (radio ? 'opf-radio' : 'opf-check') + (typ(f) === 'scale' ? ' opf-scale' : '');
    box.setAttribute('aria-label', labelOf(f)); if (radio) box.setAttribute('role', 'radiogroup');
    var EXCL = /^(aucun|aucune|rien|ne sait pas|nsp|refus|non concern)/i;
    opts.forEach(function (o) {
      var l = document.createElement('label'), i = document.createElement('input');
      i.type = kind; i.name = nom; i.value = o[0]; if (!radio && EXCL.test(o[1])) i.setAttribute('data-excl', '1');
      l.appendChild(i);
      if (typ(f) === 'scale' || (radio && /^\d+$/.test(o[0]) && !/^(oui|non)$/i.test(o[1]) && opts.length > 2)) { var c = document.createElement('span'); c.className = 'c'; c.textContent = o[0]; l.appendChild(c); }
      var t = document.createElement('span'); t.className = 't'; t.textContent = o[1]; l.appendChild(t);
      box.appendChild(l);
    });
    if (!radio) { n = document.createElement('small'); n.className = 'opf-opts-n'; }
    f.classList.add('opf-xhide'); f.tabIndex = -1;
    f.insertAdjacentElement('afterend', box); if (n) box.insertAdjacentElement('afterend', n);
    var ui = { box: box };
    ui.sync = function () {
      var v = String(f.value == null ? '' : f.value), set = radio ? null : ';' + v + ';';
      [].forEach.call(box.querySelectorAll('input'), function (i) {
        i.checked = radio ? (v !== '' && (i.value === v || (+i.value === +v && !isNaN(+v)))) : set.indexOf(';' + i.value + ';') > -1;
        i.disabled = f.disabled || f.hasAttribute('data-op-isna');
      });
      box.classList.toggle('dis', f.hasAttribute('data-op-isna'));
      if (n) { var k = box.querySelectorAll('input:checked').length; n.textContent = k ? k + ' réponse' + (k > 1 ? 's' : '') + ' cochée' + (k > 1 ? 's' : '') : 'Plusieurs réponses possibles'; }
    };
    var emettre = function () { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); };
    if (radio) {
      /* re-cliquer sur la réponse cochée l'efface (sauf champ obligatoire) */
      var avant = null;
      box.addEventListener('pointerdown', function (e) { var i = e.target.closest('label') && e.target.closest('label').querySelector('input'); avant = i && i.checked ? i : null; });
      box.addEventListener('click', function (e) {
        var i = e.target.closest('label') && e.target.closest('label').querySelector('input'); if (!i || e.target !== i) return;
        if (avant === i && !f.hasAttribute('data-op-required')) { i.checked = false; f.value = ''; ui.sync(); emettre(); }
        avant = null;
      });
      box.addEventListener('change', function (e) { if (e.target.checked) { f.value = e.target.value; ui.sync(); emettre(); } });
    } else {
      box.addEventListener('change', function (e) {
        var i = e.target;
        if (i.checked && i.hasAttribute('data-excl')) [].forEach.call(box.querySelectorAll('input'), function (x) { if (x !== i) x.checked = false; });
        if (i.checked && !i.hasAttribute('data-excl')) [].forEach.call(box.querySelectorAll('input[data-excl]'), function (x) { x.checked = false; });
        f.value = [].slice.call(box.querySelectorAll('input:checked')).map(function (x) { return x.value; }).join(';');
        ui.sync(); emettre();
      });
    }
    /* la navigation clavier de la page (Entrée, flèches) peut viser le champ porteur caché : on passe la main aux cases */
    f.addEventListener('focus', function () { var i = box.querySelector('input:checked') || box.querySelector('input:not(:disabled)'); if (i) i.focus(); });
    f._opts = ui; ui.sync();
  };
  /* ---------- 1 ter. champ fichier / photo ----------
     Le champ D0elt reste un champ texte caché qui porte l'identifiant de la pièce jointe.
     Le fichier part tout de suite vers /saisie-plus/api/fichiers/ ; l'enregistrement du formulaire n'envoie que l'identifiant. */
  var FICHIERS = {};                                    /* id -> {id, nom, taille, type, url, apercu} */
  var FICH_URL = '/saisie-plus/api/fichiers/';
  var FICH_MAX = 10 * 1024 * 1024;
  var FICH_ACCEPT = { file: '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx', photo: 'image/*' };
  function csrf() {
    var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/); if (m) return decodeURIComponent(m[1]);
    var i = document.querySelector('input[name="csrfmiddlewaretoken"]'); return i ? i.value : '';
  }
  function taille(o) { return o < 1024 ? o + ' o' : o < 1048576 ? Math.round(o / 1024) + ' Ko' : (o / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
  /* photo de téléphone (4 à 8 Mo) réduite à 1600 px avant l'envoi : plus rapide sur le réseau mobile */
  function reduire(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.2 * 1048576 || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (img) {
      var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return new Promise(function (ok) { c.toBlob(function (b) { ok(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file); }, 'image/jpeg', 0.82); });
    }).catch(function () { return file; });
  }
  P.setupFichier = function (f, t) {
    var self = this, ui = {}, photo = t === 'photo';
    f.readOnly = true; f.classList.add('opf-xhide'); f.tabIndex = -1;
    var box = document.createElement('div'); box.className = 'opf-file';
    /* deux sources : l'appareil photo (capture directe) et la galerie / les fichiers du téléphone ou de l'ordinateur */
    var inpCam = document.createElement('input'); inpCam.type = 'file'; inpCam.hidden = true; inpCam.accept = 'image/*'; inpCam.setAttribute('capture', 'environment');
    var inp = document.createElement('input'); inp.type = 'file'; inp.hidden = true; inp.accept = f.getAttribute('data-op-accept') || FICH_ACCEPT[t];
    var picks = document.createElement('span'); picks.className = 'picks';
    var cam = document.createElement('button'); cam.type = 'button'; cam.className = 'pick cam';
    var pick = document.createElement('button'); pick.type = 'button'; pick.className = 'pick gal';
    picks.appendChild(cam); picks.appendChild(pick);
    var vis = document.createElement('span'), info = document.createElement('span'); info.className = 'info';
    var act = document.createElement('span'); act.className = 'act';
    box.appendChild(inpCam); box.appendChild(inp); box.appendChild(vis); box.appendChild(info); box.appendChild(picks); box.appendChild(act);
    f.insertAdjacentElement('afterend', box);
    cam.setAttribute('aria-label', 'Prendre une photo pour ' + labelOf(f));
    pick.setAttribute('aria-label', (photo ? 'Choisir une photo dans la galerie pour ' : 'Choisir un fichier pour ') + labelOf(f));
    var tactile = window.matchMedia && matchMedia('(pointer: coarse)').matches;   /* ordinateur : pas d'appareil photo, on choisit ou on glisse-dépose */
    cam.hidden = !tactile;
    cam.addEventListener('click', function () { inpCam.click(); });
    pick.addEventListener('click', function () { inp.click(); });
    ['dragenter', 'dragover'].forEach(function (ev) { box.addEventListener(ev, function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') > -1) { e.preventDefault(); box.classList.add('drag'); } }); });
    ['dragleave', 'drop'].forEach(function (ev) { box.addEventListener(ev, function () { box.classList.remove('drag'); }); });
    box.addEventListener('drop', function (e) { e.preventDefault(); var fl = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (fl) envoyer(fl); });
    ui.afficher = function () {
      var id = String(f.value || '').trim(), d = id && id !== '0' ? FICHIERS[id] : null;
      box.classList.remove('bad'); box.classList.toggle('has', !!(id && id !== '0'));
      act.innerHTML = ''; vis.innerHTML = '';
      if (!id || id === '0') {
        info.innerHTML = '<b>' + (photo ? 'Aucune photo' : 'Aucun fichier') + '</b><small>' + (photo ? (tactile ? 'Appareil photo ou galerie' : 'JPG, PNG ou WebP · ou glissez-la ici') : 'PDF, image, Word ou Excel · 10 Mo max.' + (tactile ? '' : ' · ou glissez-le ici')) + '</small>';
        cam.textContent = 'Appareil photo'; pick.textContent = photo ? (tactile ? 'Galerie' : 'Choisir une photo') : 'Choisir un fichier'; return;
      }
      if (!d) {                                          /* valeur chargée depuis la base : on récupère le nom */
        info.innerHTML = '<b>Pièce jointe n° ' + id + '</b><small>Chargement…</small>';
        fetch(FICH_URL + encodeURIComponent(id) + '/', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.ok) { FICHIERS[id] = j.fichier; if (String(f.value) === id) ui.afficher(); } else info.innerHTML = '<b>Pièce jointe n° ' + id + '</b><small>Introuvable ou non autorisée</small>'; })
          .catch(function () {});
        cam.textContent = 'Reprendre'; pick.textContent = photo ? (tactile ? 'Galerie' : 'Autre photo') : 'Autre fichier'; return;
      }
      if (d.apercu) { var im = document.createElement('img'); im.className = 'thumb'; im.alt = ''; im.src = d.apercu; vis.appendChild(im); }
      else { var ic = document.createElement('span'); ic.className = 'ico'; ic.textContent = (d.nom.split('.').pop() || 'doc').slice(0, 4); vis.appendChild(ic); }
      info.innerHTML = ''; var b = document.createElement('b'), s = document.createElement('small'); b.textContent = d.nom; b.title = d.nom; s.textContent = taille(d.taille); info.appendChild(b); info.appendChild(s);
      cam.textContent = 'Reprendre'; pick.textContent = photo ? (tactile ? 'Galerie' : 'Autre photo') : 'Autre fichier';
      var a = document.createElement('a'); a.href = d.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Ouvrir'; act.appendChild(a);
      var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = 'Retirer';
      rm.addEventListener('click', function () { f.value = ''; ui.afficher(); f.dispatchEvent(new Event('input', { bubbles: true })); }); act.appendChild(rm);
    };
    ui.erreur = function (m) { ui.afficher(); box.classList.add('bad'); var s = info.querySelector('small'); if (s) s.textContent = m; };
    var choisi = function () { var file = this.files && this.files[0]; this.value = ''; if (file) envoyer(file); };
    inp.addEventListener('change', choisi); inpCam.addEventListener('change', choisi);
    function envoyer(file) {
      if (photo && !/^image\//.test(file.type)) { ui.erreur('Une photo est attendue (JPG, PNG ou WebP).'); return; }
      reduire(file).then(function (file) {
        if (file.size > FICH_MAX) { ui.erreur('Fichier trop lourd (' + taille(file.size) + ') : 10 Mo maximum.'); return; }
        var fd = new FormData(), ctx = (window.OperaForm && typeof window.OperaForm.contexte === 'function' && window.OperaForm.contexte()) || {};
        fd.append('fichier', file); fd.append('element', f.name.replace('D0elt', '')); fd.append('type', t);
        Object.keys(ctx).forEach(function (k) { if (ctx[k] != null) fd.append(k, ctx[k]); });
        var x = new XMLHttpRequest(); x.open('POST', self.opts.fichiersUrl || FICH_URL); x.setRequestHeader('X-CSRFToken', csrf()); x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        ui.enCours = true; pick.disabled = cam.disabled = true; act.innerHTML = '';
        info.innerHTML = '<b></b><small>Envoi…</small><span class="bar"><i></i></span>'; info.querySelector('b').textContent = file.name;
        var bar = info.querySelector('.bar i');
        x.upload.onprogress = function (e) { if (e.lengthComputable) bar.style.width = Math.round(e.loaded / e.total * 100) + '%'; };
        x.onload = function () {
          ui.enCours = false; pick.disabled = cam.disabled = false; var j = null; try { j = JSON.parse(x.responseText); } catch (e) {}
          if (x.status >= 200 && x.status < 300 && j && j.ok) { FICHIERS[String(j.fichier.id)] = j.fichier; f.value = String(j.fichier.id); ui.afficher(); self.msg(f, '', ''); f.dispatchEvent(new Event('input', { bubbles: true })); }
          else ui.erreur((j && j.error) || (x.status === 403 ? 'Session expirée : reconnectez-vous.' : 'Envoi impossible (' + x.status + ').'));
        };
        x.onerror = function () { ui.enCours = false; pick.disabled = cam.disabled = false; ui.erreur('Pas de réseau : réessayez quand la connexion revient.'); };
        x.send(fd);
      });
    }
    f.addEventListener('focus', function () { (cam.offsetParent ? cam : pick).focus(); });
    f._fichier = ui; ui.afficher();
  };
  /* après un remplissage par le code (chargement des valeurs, brouillon) */
  P.syncTypes = function () {
    this.fields.forEach(function (f) {
      if (f._fichier) f._fichier.afficher();
      if (f._opts) f._opts.sync();
    });
  };
  P.refresh = function () { this.syncTypes(); this.recalc(); this.conditions(); };
  P.msg = function (f, cls, text) {
    var id = 'opf-m-' + f.name, m = document.getElementById(id) || (function () { var s = document.createElement('small'); s.id = id; f.insertAdjacentElement('afterend', s); return s; })();
    if (!text) { m.className = ''; m.textContent = ''; return; }
    m.className = cls; m.textContent = text;
  };
  P.fieldIssues = function (f) {
    var out = { err: '', warn: '' };
    if (f.closest('.opf-hidden') || f.hasAttribute('data-op-isna') || f.classList.contains('opf-calc')) return out;
    var v = f.value, n = num(v), name = labelOf(f);
    if (f.hasAttribute('data-op-required') && (v === '' || v == null)) { out.err = 'Champ obligatoire.'; return out; }
    if (v === '' || f.tagName === 'SELECT') return out;
    var t = typ(f);
    if (t === 'tel') { var dg = v.replace(/\D/g, ''); if (!/^\+?[\d\s.\-()]+$/.test(v) || dg.length < 8 || dg.length > 15) out.err = 'Numéro de téléphone invalide (ex. 6XX XX XX XX ou +237 6XX XX XX XX).'; return out; }
    if (t === 'email') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) out.err = 'Adresse e-mail invalide.'; return out; }
    if (t === 'gps') { var g = v.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/); if (!g || Math.abs(+g[1]) > 90 || Math.abs(+g[2]) > 180) out.err = 'Coordonnées invalides : « latitude, longitude » (ex. 4.0511, 9.7679).'; return out; }
    if (t === 'date') { var d = new Date(v + 'T00:00:00'); if (!isNaN(d) && d.getTime() > Date.now() + 864e5) out.warn = 'Date dans le futur : vérifiez-la.'; return out; }
    if (t === 'file' || t === 'photo') { if (f._fichier && f._fichier.enCours) out.err = 'Envoi du fichier en cours : patientez quelques secondes.'; return out; }
    if (t === 'multi' || t === 'text' || t === 'long' || t === 'time') return out;
    if (f.type === 'number' || f.hasAttribute('data-op-min') || f.hasAttribute('data-op-max')) {
      if (isNaN(n)) { out.err = 'Saisissez un nombre.'; return out; }
      if (f.hasAttribute('data-op-int') && Math.round(n) !== n) out.err = 'Saisissez un nombre entier.';
      var mn = num(f.getAttribute('data-op-min')), mx = num(f.getAttribute('data-op-max'));
      if (!out.err && !isNaN(mn) && n < mn) out.err = 'La valeur doit être au moins ' + fmt(mn) + '.';
      if (!out.err && !isNaN(mx) && n > mx) out.err = 'La valeur ne peut pas dépasser ' + fmt(mx) + '.';
      var smn = num(f.getAttribute('data-op-soft-min')), smx = num(f.getAttribute('data-op-soft-max'));
      if (!out.err && ((!isNaN(smn) && n < smn) || (!isNaN(smx) && n > smx))) out.warn = 'Valeur inhabituelle (attendu entre ' + (isNaN(smn) ? '…' : fmt(smn)) + ' et ' + (isNaN(smx) ? '…' : fmt(smx)) + ') : vérifiez-la.';
    }
    return out;
  };
  P.check = function (f) {
    var r = this.fieldIssues(f);
    f.classList.toggle('opf-bad', !!r.err); f.classList.toggle('opf-soft', !r.err && !!r.warn);
    this.msg(f, r.err ? 'opf-err' : 'opf-warn', r.err || r.warn);
    return r;
  };

  /* ---------- 2. non applicable ---------- */
  P.setupNA = function () {
    var self = this;
    this.fields.forEach(function (f) {
      if (!f.hasAttribute('data-op-na')) return;
      var lab = document.createElement('label'); lab.className = 'opf-na';
      var cb = document.createElement('input'); cb.type = 'checkbox';
      var hid = document.createElement('input'); hid.type = 'hidden'; hid.name = 'op_na_' + f.name; hid.value = '';
      lab.appendChild(cb); lab.appendChild(document.createTextNode('N/A')); lab.title = 'Non applicable (différent de 0)';
      f.insertAdjacentElement('afterend', lab); lab.insertAdjacentElement('afterend', hid);
      cb.addEventListener('change', function () {
        if (cb.checked) { f.setAttribute('data-op-isna', ''); f._prev = f.value; f.value = f.type === 'number' ? '0' : ''; f.readOnly = true; f.classList.add('opf-isna'); hid.value = '1'; }
        else { f.removeAttribute('data-op-isna'); f.value = f._prev || ''; f.readOnly = false; f.classList.remove('opf-isna'); hid.value = ''; }
        if (f._opts) f._opts.sync();
        self.check(f); self.recalc(); self.saveDraftSoon();
      });
      f._na = cb;
    });
  };

  /* ---------- 3. totaux calculés ---------- */
  P.setupCalc = function () {
    this.calc = [].slice.call(this.root.querySelectorAll('[data-op-sum]'));   /* y compris les totaux sans nom (affichage seulement) */
    this.calc.forEach(function (f) { f.readOnly = true; f.classList.add('opf-calc'); f.tabIndex = -1; });
  };
  P.recalc = function () {
    var self = this;
    for (var pass = 0; pass < 3; pass++) this.calc.forEach(function (f) {
      var parts = f.getAttribute('data-op-sum').split(',').map(function (s) { return s.trim(); }).filter(Boolean), t = 0;
      parts.forEach(function (n) { var x = self.byName[n]; if (x && !x.closest('.opf-hidden')) { var v = num(x.value); if (!isNaN(v)) t += v; } });
      f.value = String(Math.round(t * 1000) / 1000);
    });
  };

  /* ---------- 4. questions conditionnelles ---------- */
  P.parseCond = function (c) {
    var m = String(c).match(/^\s*(D0elt[\w-]+)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$/); if (!m) return null;
    return { name: m[1], op: m[2], val: m[3].replace(/^['"]|['"]$/g, '') };
  };
  P.evalCond = function (c) {
    var f = this.byName[c.name]; if (!f) return true;
    if (typ(f) === 'multi' && (c.op === '==' || c.op === '!=')) { var has = (';' + f.value + ';').indexOf(';' + c.val + ';') > -1; return c.op === '==' ? has : !has; }
    var a = f.value, b = c.val, na = num(a), nb = num(b), useNum = !isNaN(na) && !isNaN(nb);
    switch (c.op) {
      case '==': return useNum ? na === nb : a === b; case '!=': return useNum ? na !== nb : a !== b;
      case '>': return useNum && na > nb; case '<': return useNum && na < nb; case '>=': return useNum && na >= nb; case '<=': return useNum && na <= nb;
    } return true;
  };
  P.groupOf = function (el) {
    /* un titre de section entraîne tout ce qui le suit jusqu'au prochain titre ou saut de page */
    if (!el.classList.contains('op-section')) return [el];
    var out = [el], n = el.nextElementSibling;
    while (n && !n.classList.contains('op-section') && !n.classList.contains('op-page')) { out.push(n); n = n.nextElementSibling; }
    return out;
  };
  P.setupConditions = function () {
    var self = this; this.conds = [];
    this.root.querySelectorAll('[data-op-show-if]').forEach(function (el) {
      var c = el.getAttribute('data-op-show-if').split('&&').map(function (x) { return self.parseCond(x); }).filter(Boolean);
      if (c.length) self.conds.push({ el: el, c: c, group: self.groupOf(el) });
    });
  };
  P.conditions = function () {
    var self = this, changed = false;
    this.conds.forEach(function (k) {
      var show = k.c.every(function (c) { return self.evalCond(c); });
      k.group.forEach(function (g) {
        var was = g.classList.contains('opf-hidden'); g.classList.toggle('opf-hidden', !show);
        if (!show && !was) { changed = true; g.querySelectorAll('input[name^="D0elt"],select[name^="D0elt"]').forEach(function (f) { f._hidVal = f.value; f.value = f.getAttribute('data-op-hidden-value') || (f.tagName === 'SELECT' ? f.value : '0'); f._hidSet = f.value; self.msg(f, '', ''); f.classList.remove('opf-bad', 'opf-soft'); }); }
        if (show && was) { changed = true; g.querySelectorAll('input[name^="D0elt"],select[name^="D0elt"]').forEach(function (f) { if (f._hidVal != null && f.value === f._hidSet) f.value = f._hidVal; f._hidVal = f._hidSet = null; });   /* une valeur posée entre-temps (chargement) est gardée */ }
      });
    });
    if (changed) this.recalc();
  };

  /* ---------- 5. cohérence entre champs ---------- */
  P.ruleIssues = function () {
    var self = this, out = [];
    this.rules.forEach(function (r) {
      var g = function (n) { var f = self.byName[n]; return f && !f.closest('.opf-hidden') ? num(f.value) : NaN; };
      if (r.type === 'sum') {
        var t = g(r.target), s = 0, ok = !isNaN(t);
        (r.parts || []).forEach(function (p) { var v = g(p); if (isNaN(v)) ok = false; else s += v; });
        if (ok && Math.abs(t - s) > 1e-9) out.push({ level: r.level || 'err', text: (r.label || 'Somme incohérente') + ' : ' + fmt(t) + ' saisi, ' + fmt(s) + ' attendu.', fields: [r.target].concat(r.parts || []) });
      } else if (r.type === 'lte' || r.type === 'gte' || r.type === 'eq') {
        var a = g(r.a), b = g(r.b); if (isNaN(a) || isNaN(b)) return;
        var bad = r.type === 'lte' ? a > b : r.type === 'gte' ? a < b : a !== b;
        if (bad) out.push({ level: r.level || 'err', text: (r.label || 'Valeurs incohérentes') + ' (' + fmt(a) + ' / ' + fmt(b) + ').', fields: [r.a, r.b] });
      }
    });
    return out;
  };
  P.validateAll = function (submitting, scope) {
    var self = this, errs = [], warns = [], first = null;
    this.fields.forEach(function (f) {
      if (scope && !scope.contains(f)) return;
      var r = self.check(f);
      if (r.err) { errs.push(labelOf(f) + ' : ' + r.err); first = first || f; } else if (r.warn) warns.push(labelOf(f) + ' : ' + r.warn);
    });
    if (!scope) this.ruleIssues().forEach(function (i) {
      (i.level === 'warn' ? warns : errs).push(i.text);
      i.fields.forEach(function (n) { var f = self.byName[n]; if (f) f.classList.add(i.level === 'warn' ? 'opf-soft' : 'opf-bad'); if (!first && i.level !== 'warn') first = f; });
    });
    var box = this.root.querySelector('.opf-sum') || (function () { var d = document.createElement('div'); d.className = 'opf-sum'; d.setAttribute('role', 'alert'); (self.navEl || self.form.querySelector('[type=submit]') || self.root.lastChild).insertAdjacentElement(self.navEl ? 'beforebegin' : 'beforebegin', d); return d; })();
    var esc = function (t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
    if (errs.length) {
      box.style.display = ''; box.className = 'opf-sum bad'; box.innerHTML = '<b>' + errs.length + ' point(s) à corriger avant l’envoi</b><ul>' + errs.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      if (first && submitting) { this.gotoField(first); setTimeout(function () { first.focus(); }, 50); }
      return false;
    }
    if (warns.length && submitting) {
      var cbx = box.querySelector('#opf-confirm');
      if (cbx && cbx.checked) { box.className = 'opf-sum'; box.innerHTML = ''; return true; }
      box.style.display = ''; box.className = 'opf-sum warn'; box.innerHTML = '<b>' + warns.length + ' valeur(s) inhabituelle(s)</b><ul>' + warns.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul><label><input type="checkbox" id="opf-confirm"> Je confirme ces valeurs</label>';
      return false;
    }
    box.className = 'opf-sum'; box.innerHTML = ''; box.style.display = errs.length || warns.length ? '' : 'none';
    return true;
  };

  /* ---------- 6. sections et pages ---------- */
  P.setupPages = function () {
    var breaks = this.root.querySelectorAll('hr.op-page'); if (!breaks.length) return;
    var container = breaks[0].parentNode, kids = [].slice.call(container.children), pages = [[]];
    kids.forEach(function (k) { if (k.matches('hr.op-page')) { k.style.display = 'none'; pages.push([]); } else pages[pages.length - 1].push(k); });
    pages = pages.filter(function (p) { return p.length; }); if (pages.length < 2) return;
    var self = this; this.pages = pages.map(function (els, i) {
      var w = document.createElement('div'); w.className = 'op-page-wrap'; els[0].insertAdjacentElement('beforebegin', w); els.forEach(function (e) { w.appendChild(e); });
      var t = w.querySelector('.op-section'); return { el: w, title: t ? t.textContent.trim() : 'Partie ' + (i + 1) };
    });
    var steps = document.createElement('div'); steps.className = 'opf-steps';
    this.pages.forEach(function (p, i) { var b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + '. ' + p.title; b.addEventListener('click', function () { self.showPage(i); }); steps.appendChild(b); p.btn = b; });
    this.pages[0].el.insertAdjacentElement('beforebegin', steps);
    var nav = document.createElement('div'); nav.className = 'opf-nav'; nav.innerHTML = '<button type="button" class="prev">Précédent</button><button type="button" class="next">Suivant</button>';
    this.pages[this.pages.length - 1].el.insertAdjacentElement('afterend', nav); this.navEl = nav;
    nav.querySelector('.prev').addEventListener('click', function () { self.showPage(self.cur - 1); });
    nav.querySelector('.next').addEventListener('click', function () { if (self.validateAll(false, self.pages[self.cur].el)) { self.pages[self.cur].btn.classList.add('done'); self.showPage(self.cur + 1); } });
    this.submitBtn = this.form.querySelector('[type=submit]');
    this.showPage(0);
  };
  P.showPage = function (i) {
    if (!this.pages) return; i = Math.max(0, Math.min(this.pages.length - 1, i)); this.cur = i; var last = i === this.pages.length - 1;
    this.pages.forEach(function (p, j) { p.el.style.display = j === i ? '' : 'none'; p.btn.classList.toggle('on', j === i); });
    this.navEl.querySelector('.prev').style.visibility = i ? 'visible' : 'hidden';
    this.navEl.querySelector('.next').style.display = last ? 'none' : '';
    if (this.submitBtn) this.submitBtn.style.display = last ? '' : 'none';
    var top = this.root.getBoundingClientRect().top + scrollY - 80; if (scrollY > top) scrollTo({ top: top, behavior: 'smooth' });
  };
  P.gotoField = function (f) { if (!this.pages) return; var self = this; this.pages.forEach(function (p, i) { if (p.el.contains(f)) self.showPage(i); }); };

  /* ---------- 7. GPS ---------- */
  P.setupGPS = function () {
    var self = this;
    this.root.querySelectorAll('.op-gps').forEach(function (el) {
      if (el._done) return; el._done = 1; el.classList.add('opf-gps'); el.innerHTML = '';
      var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Capturer la position GPS';
      var s = document.createElement('span'); var mk = function (n) { var h = document.createElement('input'); h.type = 'hidden'; h.name = n; el.appendChild(h); return h; };
      el.appendChild(b); el.appendChild(s); var lat = mk('op_gps_lat'), lng = mk('op_gps_lng'), acc = mk('op_gps_acc');
      b.addEventListener('click', function () {
        if (!navigator.geolocation) { s.textContent = 'GPS indisponible sur cet appareil.'; return; }
        s.textContent = 'Recherche de la position…';
        navigator.geolocation.getCurrentPosition(function (p) { lat.value = p.coords.latitude.toFixed(6); lng.value = p.coords.longitude.toFixed(6); acc.value = Math.round(p.coords.accuracy);
          s.textContent = lat.value + ', ' + lng.value + ' (± ' + acc.value + ' m)'; self.saveDraftSoon(); },
          function () { s.textContent = 'Position refusée ou introuvable.'; }, { enableHighAccuracy: true, timeout: 15000 });
      });
    });
  };

  /* ---------- 8. brouillon hors-ligne ---------- */
  P.key = function () { return 'op-draft:' + location.pathname + ':' + (this.form.getAttribute('action') || ''); };
  P.setupDraft = function () {
    var self = this, raw = null; try { raw = localStorage.getItem(this.key()); } catch (e) {}
    this.savedEl = document.createElement('div'); this.savedEl.className = 'opf-saved'; this.savedEl.textContent = 'Brouillon enregistré sur l’appareil'; document.body.appendChild(this.savedEl);
    if (!raw) return; var d; try { d = JSON.parse(raw); } catch (e) { return; }
    var bar = document.createElement('div'); bar.className = 'opf-draft';
    bar.innerHTML = '<span>Un brouillon du ' + new Date(d.t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + ' a été retrouvé sur cet appareil.</span><span><button type="button" class="y">Reprendre</button><button type="button" class="n">Ignorer</button></span>';
    (this.root.firstElementChild || this.root).insertAdjacentElement('beforebegin', bar);
    bar.querySelector('.y').addEventListener('click', function () {
      Object.keys(d.v).forEach(function (n) { var f = self.form.querySelector('[name="' + n + '"]'); if (f && f.type !== 'hidden') f.value = d.v[n]; else if (f) f.value = d.v[n]; });
      self.fields.forEach(function (f) { if (f._na && d.v['op_na_' + f.name] === '1') { f._na.checked = true; f._na.dispatchEvent(new Event('change')); } });
      self.refresh(); bar.remove();
    });
    bar.querySelector('.n').addEventListener('click', function () { self.clearDraft(); bar.remove(); });
  };
  P.saveDraftSoon = function () {
    var self = this; if (!this.savedEl) return; clearTimeout(this._dt);
    this._dt = setTimeout(function () {
      var v = {}; self.form.querySelectorAll('[name^="D0elt"], [name^="op_"]').forEach(function (f) { v[f.name] = f.value; });
      try { localStorage.setItem(self.key(), JSON.stringify({ t: Date.now(), v: v })); self.savedEl.classList.add('on'); setTimeout(function () { self.savedEl.classList.remove('on'); }, 1200); } catch (e) {}
    }, 700);
  };
  P.clearDraft = function () { try { localStorage.removeItem(this.key()); } catch (e) {} };

  function boot() {
    if (!document.getElementById('opf-style')) { var st = document.createElement('style'); st.id = 'opf-style'; st.textContent = CSS; document.head.appendChild(st); }
    var roots = document.querySelectorAll('[data-op-form]');
    if (!roots.length) roots = [].slice.call(document.querySelectorAll('form')).filter(function (f) { return f.querySelector('[name^="D0elt"]'); });
    [].forEach.call(roots, function (r) { if (!r._opf) r._opf = new OperaForm(r); });
  }
  window.OperaForm = {
    /* opts : { fresh: true } réinitialise après un rechargement du contenu ; { draft: false } laisse la page gérer le brouillon ;
       { submit: false } laisse la page gérer l'envoi (enregistrement AJAX) */
    init: function (el, opts) { if (opts && opts.fresh && el._opf) { el._opf.destroy(); el._opf = null; } return el._opf || (el._opf = new OperaForm(el, opts)); },
    boot: boot,
    /* nom lisible d'une pièce jointe (récapitulatif, fiche imprimée) */
    fichier: function (id) { return FICHIERS[String(id)] || null; },
    retenirFichier: function (d) { if (d && d.id) FICHIERS[String(d.id)] = d; }
  };
  onReady(boot);
})();
