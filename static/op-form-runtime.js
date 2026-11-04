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
    '@media (max-width:760px){.op-page-wrap>*{max-width:100%}}'
  ].join('\n');

  function onReady(f) { if (document.readyState !== 'loading') f(); else document.addEventListener('DOMContentLoaded', f); }
  function num(v) { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); }
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('fr-FR'); }
  function labelOf(el) { return el.getAttribute('data-op-label') || el.getAttribute('title') || el.name; }

  function OperaForm(root) {
    this.root = root;
    this.form = root.tagName === 'FORM' ? root : root.closest('form') || root;
    this.fields = [].slice.call(root.querySelectorAll('input[name^="D0elt"], select[name^="D0elt"], textarea[name^="D0elt"]'));
    if (!this.fields.length) return;
    this.byName = {}; var self = this;
    this.fields.forEach(function (f) { self.byName[f.name] = f; });
    this.rules = [];
    root.querySelectorAll('.op-rules[data-rules]').forEach(function (d) { try { self.rules = self.rules.concat(JSON.parse(d.getAttribute('data-rules')) || []); } catch (e) {} d.style.display = 'none'; });
    this.setupFields(); this.setupNA(); this.setupCalc(); this.setupConditions(); this.setupPages(); this.setupGPS(); this.setupDraft();
    root.addEventListener('input', function (e) { if (e.target.name && e.target.name.indexOf('D0elt') === 0) { self.recalc(); self.conditions(); self.check(e.target); self.saveDraftSoon(); } });
    root.addEventListener('change', function (e) { if (e.target.name && e.target.name.indexOf('D0elt') === 0) { self.recalc(); self.conditions(); self.check(e.target); self.saveDraftSoon(); } });
    this.form.addEventListener('submit', function (e) { if (!self.validateAll(true)) { e.preventDefault(); e.stopImmediatePropagation(); } else self.clearDraft(); }, true);
    this.recalc(); this.conditions();
  }
  var P = OperaForm.prototype;

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
        if (!show && !was) { changed = true; g.querySelectorAll('input[name^="D0elt"],select[name^="D0elt"]').forEach(function (f) { f._hidVal = f.value; f.value = f.getAttribute('data-op-hidden-value') || (f.tagName === 'SELECT' ? f.value : '0'); self.msg(f, '', ''); f.classList.remove('opf-bad', 'opf-soft'); }); }
        if (show && was) { changed = true; g.querySelectorAll('input[name^="D0elt"],select[name^="D0elt"]').forEach(function (f) { if (f._hidVal != null) f.value = f._hidVal; }); }
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
      self.recalc(); self.conditions(); bar.remove();
    });
    bar.querySelector('.n').addEventListener('click', function () { self.clearDraft(); bar.remove(); });
  };
  P.saveDraftSoon = function () {
    var self = this; clearTimeout(this._dt);
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
  window.OperaForm = { init: function (el) { return el._opf || (el._opf = new OperaForm(el)); }, boot: boot };
  onReady(boot);
})();
