/*!
 * OperaPlus · outils avancés du designer de formulaire (op-designer-pro.js)
 * À charger APRÈS tinymce.init dans le designer :
 *   <script src="{% static 'operaplus/op-designer-pro.js' %}"></script>
 * Tout ce qui est réglé ici est écrit dans le formulaire lui-même (attributs data-op-*),
 * donc enregistré avec votre champ form_design actuel, sans changer le serveur.
 * Les règles sont appliquées pendant la saisie par op-form-runtime.js.
 */
(function () {
  'use strict';
  var SELF = document.currentScript && document.currentScript.src || '';
  var RUNTIME = SELF ? SELF.replace(/op-designer-pro(\.min)?\.js.*$/, 'op-form-runtime.js') : 'op-form-runtime.js';
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  /* ------------------------------------------------------------------ styles de l'interface */
  var CSS = `
  .opd-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px;padding:8px;border-radius:14px;background:#fff;border:1px solid #e4e8ee}
  .opd-g{display:flex;gap:4px;align-items:center;padding-right:8px;margin-right:2px;border-right:1px solid #eef1f4}
  .opd-g:last-child{border-right:0}
  .opd-g small{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#98a2b3;margin:0 4px 0 2px}
  .opd-b{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:9px;border:1px solid transparent;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:#344054;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}
  .opd-b:hover{background:#f5f7fa;border-color:#e4e8ee;color:#0b1220}
  .opd-b i{font-size:13px;opacity:.85}
  .opd-b.pri{background:var(--dom,#123A37);color:#fff}.opd-b.pri:hover{filter:brightness(.92);color:#fff}
  .opd-badge{font-style:normal;font-size:10.5px;padding:0 6px;border-radius:999px;background:#eef1f4;color:#475467}
  .opd-badge.w{background:#FFF3EF;color:#C2410C}
  /* panneau de propriétés */
  .opd-drawer{position:fixed;top:56px;right:0;bottom:0;width:360px;max-width:100%;z-index:1500;background:#fff;border-left:1px solid #e4e8ee;box-shadow:-20px 0 40px -30px rgba(15,27,45,.45);transform:translateX(105%);transition:transform .25s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column}
  .opd-drawer.on{transform:none}
  .main-container>.left-bar{flex-shrink:0}
  body.opd-open .main-container>.flex-grow{margin-right:360px;transition:margin .25s}
  @media (max-width:1200px){body.opd-open .main-container>.flex-grow{margin-right:0}}
  .opd-dh{padding:16px 18px;border-bottom:1px solid #eef1f4;display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .opd-dh small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#98a2b3}
  .opd-dh b{display:block;margin-top:2px;font-size:15px;font-weight:800;color:#0b1220;line-height:1.3}
  .opd-dh code{font-size:11.5px;color:var(--dom,#123A37);background:#eef4f3;padding:1px 6px;border-radius:6px}
  .opd-x{width:32px;height:32px;border-radius:9px;border:1px solid #e4e8ee;background:#fff;cursor:pointer;font-size:16px;line-height:1;color:#475467;flex-shrink:0}
  .opd-db{flex:1;overflow-y:auto;padding:14px 18px 20px}
  .opd-sec{margin:0 0 16px}.opd-sec h5{margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--c,#667085);display:flex;align-items:center;gap:8px}
  .opd-sec h5::before{content:"";width:8px;height:8px;border-radius:2px;background:var(--c,#667085)}
  .opd-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
  .opd-f label,.opd-lab{display:block;font-size:12px;font-weight:700;color:#344054;margin-bottom:4px}
  .opd-f input,.opd-f select,.opd-f textarea,.opd-in{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;color:#0b1220;background:#fff;outline:none}
  .opd-f input:focus,.opd-f select:focus,.opd-f textarea:focus,.opd-in:focus{border-color:var(--dom,#123A37);box-shadow:0 0 0 3px rgba(18,58,55,.1)}
  .opd-ck{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #eef1f4;border-radius:10px;margin-bottom:6px;font-size:13px;font-weight:600;color:#344054;cursor:pointer}
  .opd-ck input{width:16px;height:16px;accent-color:var(--dom,#123A37)}
  .opd-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;border-radius:10px;background:#f2f4f7;margin-bottom:8px}
  .opd-seg button{border:0;background:transparent;border-radius:8px;padding:7px;font:inherit;font-size:12.5px;font-weight:700;color:#667085;cursor:pointer}
  .opd-seg button.on{background:#fff;color:#0b1220;box-shadow:0 1px 3px rgba(16,24,40,.15)}
  .opd-hint{font-size:11.5px;color:#98a2b3;margin:4px 0 0;line-height:1.45}
  .opd-chips{display:flex;flex-wrap:wrap;gap:4px;max-height:150px;overflow-y:auto;padding:6px;border:1px solid #eef1f4;border-radius:10px}
  .opd-chips label{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;border:1px solid #e4e8ee;font-size:12px;font-weight:600;cursor:pointer}
  .opd-chips label:has(input:checked){background:#eef4f3;border-color:var(--dom,#123A37);color:var(--dom,#123A37)}
  .opd-chips input{display:none}
  .opd-link{border:0;background:none;padding:0;color:var(--danger,#E35A33);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
  /* fenêtres */
  .opd-ov{position:fixed;inset:0;z-index:1600;background:rgba(15,27,45,.5);display:none;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow-y:auto}
  .opd-ov.on{display:flex}
  .opd-m{width:100%;max-width:760px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(15,27,45,.55);animation:opdIn .25s cubic-bezier(.2,.9,.3,1.2) both}
  @keyframes opdIn{from{opacity:0;transform:translateY(10px) scale(.98)}}
  .opd-mh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 20px;background:var(--dom,#123A37);color:#fff;position:relative}
  .opd-mh::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--acc,#E48B0C)}
  .opd-mh small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#F4C77D}
  .opd-mh b{font-size:17px;font-weight:800}
  .opd-mh .opd-x{background:rgba(255,255,255,.12);border:0;color:#fff}
  .opd-mb{padding:18px 20px;max-height:66vh;overflow-y:auto}
  .opd-mf{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #eef1f4;background:#fbfcfd}
  .opd-btn{height:40px;padding:0 16px;border-radius:11px;border:1px solid #e4e8ee;background:#fff;font:inherit;font-size:13.5px;font-weight:800;color:#344054;cursor:pointer}
  .opd-btn.pri{background:var(--acc,#E48B0C);border-color:transparent;color:#fff}
  .opd-btn.dom{background:var(--dom,#123A37);border-color:transparent;color:#fff}
  .opd-grid{width:100%;border-collapse:collapse;font-size:12.5px}
  .opd-grid th,.opd-grid td{border:1px solid #eef1f4;padding:6px;text-align:left}
  .opd-grid th{background:#fbfcfd;font-weight:800;color:#475467}
  .opd-grid select{width:100%;border:1px solid #d0d5dd;border-radius:8px;padding:5px;font:inherit;font-size:12px}
  .opd-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}
  .opd-list li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 12px;border-radius:11px;border:1px solid #eef1f4;font-size:13px}
  .opd-list li.ok{border-color:#ABDBD2;background:#EEF7F5}.opd-list li.warn{border-color:#FDD98A;background:#FFF8EB}.opd-list li.bad{border-color:#FFC4B2;background:#FFF3EF}
  .opd-list li b{font-weight:800}
  .opd-tpl{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .opd-tpl button{text-align:left;padding:14px;border-radius:14px;border:1px solid #e4e8ee;background:#fff;font:inherit;cursor:pointer;transition:border-color .2s,background .2s}
  .opd-tpl button:hover{border-color:var(--dom,#123A37);background:#f6faf9}
  .opd-tpl b{display:block;font-size:14px;font-weight:800;color:#0b1220}.opd-tpl span{display:block;margin-top:4px;font-size:12px;color:#667085;line-height:1.45}
  .opd-phone{width:390px;max-width:100%;height:720px;margin:0 auto;border:10px solid #0F1B2D;border-radius:36px;overflow:hidden;background:#fff}
  .opd-phone iframe{width:100%;height:100%;border:0}
  .opd-drop{display:block;padding:26px;border:2px dashed #d0d5dd;border-radius:14px;text-align:center;font-size:13.5px;font-weight:700;color:#475467;cursor:pointer}
  .opd-drop:hover{border-color:var(--dom,#123A37);color:var(--dom,#123A37)}
  .opd-drop input{display:none}
  @media (max-width:900px){.opd-drawer{top:0;width:100%}.opd-tpl{grid-template-columns:1fr}}
  `;
  /* styles affichés DANS l'éditeur pour rendre visibles sections, pages, conditions et règles */
  var EDITOR_CSS = `
  h3.op-section{margin:22px 0 10px;padding:8px 12px;border-left:4px solid #C98A1B;background:#FFF8EB;border-radius:4px;font-size:16px;color:#0b1220}
  hr.op-page{border:0;border-top:2px dashed #2B3A67;margin:26px 0;height:0;overflow:visible}
  hr.op-page::after{content:"Nouvelle page";display:inline-block;position:relative;top:-11px;left:50%;transform:translateX(-50%);padding:0 10px;background:#fff;color:#2B3A67;font:800 11px Inter,Arial;letter-spacing:.08em;text-transform:uppercase}
  [data-op-show-if]{outline:1px dashed #7A4E9E;outline-offset:2px}
  p[data-op-show-if]::before,h3[data-op-show-if]::before{content:"Conditionnel";display:inline-block;margin-right:8px;padding:1px 7px;border-radius:999px;background:#F3ECF8;color:#7A4E9E;font:800 10px Inter,Arial;vertical-align:2px}
  input.form-control[data-op-required],select.form-control[data-op-required]{border-color:#E35A33!important}
  input.form-control[data-op-sum]{background:#F2F4F7!important;border-style:dashed!important;color:#475467!important}
  input[data-op-sum]:not([name]){width:80px;text-align:center}
  select.form-control{border:2px solid #276696;background:#f0f7ff;color:#276696;font-weight:bold;padding:4px;border-radius:4px}
  .op-gps{display:inline-block;padding:8px 12px;border:1px dashed #2A8A7D;border-radius:8px;background:#EEF7F5;color:#1F6F65;font-weight:700}
  .op-rules{display:block;margin-top:20px;padding:8px 12px;border:1px dashed #98a2b3;border-radius:8px;color:#667085;font-size:12px}
  .op-todo{background:#FFF3EF;border:1px dashed #E35A33;padding:6px 10px;border-radius:6px;color:#9E351C}
  `;

  /* ------------------------------------------------------------------ utilitaires */
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var norm = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  function ed() { return window.tinymce && tinymce.activeEditor; }
  function body() { var e = ed(); return e && e.getBody(); }
  function touched() { var e = ed(); if (!e) return; e.undoManager.add(); e.setDirty(true); e.fire('change'); }
  function toast(t) { var el = $('.fd-toast'); if (!el) { el = document.createElement('div'); el.className = 'fd-toast'; document.body.appendChild(el); } el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, 2400); }
  /* catalogue des éléments du jeu de données (pris dans la colonne de gauche) */
  function catalog() {
    return $$('#section-de .element-item').map(function (it) { return { id: (($('.font-mono', it) || {}).textContent || '').replace('#', '').trim(), name: (it.querySelector(':scope > span') || {}).textContent.trim() }; });
  }
  function catInd() { return $$('#section-ind .element-item').map(function (it) { return { id: (($('.font-mono', it) || {}).textContent || '').replace('#', '').trim(), name: (it.querySelector(':scope > span') || {}).textContent.trim() }; }); }
  function nameOf(id) { var c = catalog().filter(function (x) { return x.id === String(id); })[0]; return c ? c.name : 'Élément #' + id; }
  function placedFields() { var b = body(); return b ? $$('[name^="D0elt"]', b) : []; }
  function placedIds() { var o = {}; placedFields().forEach(function (f) { o[f.getAttribute('name').slice(5)] = 1; }); return o; }
  function fieldInput(id, name, extra) { return '<input class="form-control" name="D0elt' + esc(id) + '" type="number" title="' + esc(name) + '" value="0"' + (extra || '') + ' />'; }
  function optList(sel, withEmpty, emptyLbl) {
    return (withEmpty ? '<option value="">' + esc(emptyLbl || '— choisir —') + '</option>' : '') + catalog().map(function (c) { return '<option value="' + esc(c.id) + '"' + (String(sel) === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
  }

  /* ------------------------------------------------------------------ fenêtre générique */
  var ov, mEl;
  function modal(kicker, title, html, foot) {
    if (!ov) { ov = document.createElement('div'); ov.className = 'opd-ov'; ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); }); document.body.appendChild(ov); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) closeModal(); }); }
    ov.innerHTML = '<div class="opd-m" role="dialog" aria-modal="true"><div class="opd-mh"><div><small>' + esc(kicker) + '</small><b>' + esc(title) + '</b></div><button type="button" class="opd-x" aria-label="Fermer">×</button></div><div class="opd-mb">' + html + '</div>' + (foot ? '<div class="opd-mf">' + foot + '</div>' : '') + '</div>';
    ov.classList.add('on'); mEl = $('.opd-m', ov); $('.opd-x', ov).addEventListener('click', closeModal);
    var first = $('input,select,textarea,button.opd-btn', $('.opd-mb', ov)); if (first) setTimeout(function () { first.focus(); }, 30);
    return mEl;
  }
  function closeModal() { if (ov) { ov.classList.remove('on'); ov.innerHTML = ''; } }

  /* ------------------------------------------------------------------ barre d'outils */
  function buildBar() {
    var host = $('.editor-container'); if (!host || $('.opd-bar')) return;
    var bar = document.createElement('div'); bar.className = 'opd-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Outils de conception');
    bar.innerHTML =
      '<div class="opd-g"><small>Structure</small>' +
      '<button type="button" class="opd-b" data-a="section"><i class="fas fa-heading"></i>Section</button>' +
      '<button type="button" class="opd-b" data-a="page"><i class="fas fa-file-circle-plus"></i>Saut de page</button>' +
      '<button type="button" class="opd-b" data-a="gps"><i class="fas fa-location-dot"></i>GPS</button></div>' +
      '<div class="opd-g"><small>Règles</small>' +
      '<button type="button" class="opd-b" data-a="props"><i class="fas fa-sliders"></i>Propriétés du champ</button>' +
      '<button type="button" class="opd-b" data-a="rules"><i class="fas fa-scale-balanced"></i>Cohérence <em class="opd-badge" id="opdNR">0</em></button></div>' +
      '<div class="opd-g"><small>Construire</small>' +
      '<button type="button" class="opd-b" data-a="disag"><i class="fas fa-table"></i>Désagrégation</button>' +
      '<button type="button" class="opd-b" data-a="tpl"><i class="fas fa-shapes"></i>Modèles</button>' +
      '<button type="button" class="opd-b" data-a="xls"><i class="fas fa-file-excel"></i>Importer XLSForm</button></div>' +
      '<div class="opd-g"><small>Contrôler</small>' +
      '<button type="button" class="opd-b" data-a="mobile"><i class="fas fa-mobile-screen"></i>Aperçu mobile</button>' +
      '<button type="button" class="opd-b" data-a="paper"><i class="fas fa-print"></i>Version papier</button>' +
      '<button type="button" class="opd-b" data-a="versions"><i class="fas fa-clock-rotate-left"></i>Versions</button>' +
      '<button type="button" class="opd-b pri" data-a="check"><i class="fas fa-circle-check"></i>Vérifier <em class="opd-badge" id="opdNC">0</em></button></div>';
    host.parentNode.insertBefore(bar, host);
    bar.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b) return; ACTIONS[b.dataset.a](); });
  }

  /* ------------------------------------------------------------------ structure */
  function insertSection() { var e = ed(); e.insertContent('<h3 class="op-section">Nouvelle section</h3><p>&nbsp;</p>'); touched(); toast('Section ajoutée : cliquez sur son titre pour le renommer.'); }
  function insertPage() { var e = ed(); e.insertContent('<hr class="op-page" /><h3 class="op-section">Nouvelle partie</h3><p>&nbsp;</p>'); touched(); toast('Saut de page ajouté : sur mobile, le formulaire avancera page par page.'); }
  function insertGps() { var e = ed(); if ($('.op-gps', body())) { toast('Le formulaire contient déjà une capture GPS.'); return; } e.insertContent('<div class="op-gps" contenteditable="false">Position GPS de la fiche (capturée par l’agent à la saisie)</div><p>&nbsp;</p>'); touched(); }

  /* ------------------------------------------------------------------ propriétés du champ */
  var drawer, curEl;
  function blockOf(el) { var b = body(); if (!el || !b) return null; var tr = el.closest('tr'); if (tr) return tr; var n = el; while (n && n.parentNode !== b) n = n.parentNode; return n && n !== b ? n : null; }
  function buildDrawer() {
    drawer = document.createElement('aside'); drawer.className = 'opd-drawer'; drawer.setAttribute('aria-label', 'Propriétés du champ');
    document.body.appendChild(drawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('on') && !(ov && ov.classList.contains('on'))) closeDrawer(); });
  }
  function closeDrawer() { drawer.classList.remove('on'); document.body.classList.remove('opd-open'); curEl = null; }
  function openProps(el) {
    var b = body(); if (!b) return;
    if (!el) { var s = ed().selection.getNode(); el = s && (s.matches && s.matches('[name^="D0elt"], h3.op-section') ? s : (s.closest && s.closest('h3.op-section'))); }
    if (!el) { var any = $('[name^="D0elt"]', b); if (!any) { toast('Insérez d’abord un élément depuis la colonne de gauche.'); return; } toast('Cliquez sur un champ dans le formulaire pour régler ses propriétés.'); return; }
    curEl = el; renderDrawer();
  }
  function attr(el, n) { var v = el.getAttribute(n); return v == null ? '' : v; }
  function condParts(el) { var blk = el.matches('h3.op-section') ? el : blockOf(el); var c = blk ? attr(blk, 'data-op-show-if') : ''; var m = c.match(/^\s*D0elt([\w-]+)\s*(==|!=|>=|<=|>|<)\s*(.*)$/); return { blk: blk, id: m ? m[1] : '', op: m ? m[2] : '==', val: m ? m[3] : '' }; }
  function renderDrawer() {
    var el = curEl; if (!el) return; var isSec = el.matches('h3.op-section'), name = isSec ? el.textContent.trim() : (attr(el, 'title') || nameOf(attr(el, 'name').slice(5)));
    var id = isSec ? '' : attr(el, 'name').slice(5), isSel = el.tagName === 'SELECT', cp = condParts(el);
    var others = catalog().filter(function (c) { return c.id !== id; });
    var condSel = '<option value="">— toujours affiché —</option>' + others.map(function (c) { return '<option value="' + esc(c.id) + '"' + (cp.id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    var h = '<div class="opd-dh"><div><small>' + (isSec ? 'Section' : 'Champ de saisie') + '</small><b>' + esc(name) + '</b>' + (id ? '<code>D0elt' + esc(id) + '</code>' : '') + '</div><button type="button" class="opd-x" aria-label="Fermer">×</button></div><div class="opd-db">';
    if (!isSec) {
      var opts = isSel ? $$('option', el).map(function (o) { return o.value + '=' + o.textContent; }).join('\n') : '1=Oui\n0=Non';
      h += '<div class="opd-sec" style="--c:#2B3A67"><h5>Type de réponse</h5><div class="opd-seg"><button type="button" data-t="num" class="' + (isSel ? '' : 'on') + '">Nombre</button><button type="button" data-t="sel" class="' + (isSel ? 'on' : '') + '">Liste de choix</button></div>' +
        '<div class="opd-f" id="opdChoices" style="' + (isSel ? '' : 'display:none') + '"><label>Choix proposés (une ligne : valeur=libellé)</label><textarea rows="4" id="opdOpts">' + esc(opts) + '</textarea>' +
        '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button type="button" class="opd-b" data-p="yn">Oui / Non</button><button type="button" class="opd-b" data-p="s5">Échelle 1 à 5</button><button type="button" class="opd-b" data-p="sx">Sexe</button></div>' +
        '<p class="opd-hint">Les valeurs restent des nombres : le serveur reçoit toujours une valeur numérique pour ce champ.</p></div></div>';
      h += '<div class="opd-sec" style="--c:#E35A33"><h5>Validation</h5>' +
        '<label class="opd-ck"><input type="checkbox" data-k="data-op-required"' + (el.hasAttribute('data-op-required') ? ' checked' : '') + '>Réponse obligatoire</label>' +
        (isSel ? '' : '<label class="opd-ck"><input type="checkbox" data-k="data-op-int"' + (el.hasAttribute('data-op-int') ? ' checked' : '') + '>Nombre entier uniquement</label>' +
        '<div class="opd-row"><div class="opd-f"><label>Minimum</label><input type="number" step="any" data-v="data-op-min" value="' + esc(attr(el, 'data-op-min')) + '" placeholder="ex. 0"></div><div class="opd-f"><label>Maximum</label><input type="number" step="any" data-v="data-op-max" value="' + esc(attr(el, 'data-op-max')) + '" placeholder="ex. 500"></div></div>' +
        '<p class="opd-hint" style="margin-top:-2px">Hors de ces bornes, la fiche ne peut pas être envoyée.</p>') + '</div>';
      if (!isSel) h += '<div class="opd-sec" style="--c:#C98A1B"><h5>Alerte valeur inhabituelle</h5><div class="opd-row"><div class="opd-f"><label>Alerter si moins de</label><input type="number" step="any" data-v="data-op-soft-min" value="' + esc(attr(el, 'data-op-soft-min')) + '"></div><div class="opd-f"><label>Alerter si plus de</label><input type="number" step="any" data-v="data-op-soft-max" value="' + esc(attr(el, 'data-op-soft-max')) + '"></div></div><p class="opd-hint">La valeur est acceptée, mais l’agent doit la confirmer.</p></div>' +
        '<div class="opd-sec" style="--c:#2A8A7D"><h5>Non applicable</h5><label class="opd-ck"><input type="checkbox" data-k="data-op-na"' + (el.hasAttribute('data-op-na') ? ' checked' : '') + '>Proposer « N/A » (différent de 0)</label><p class="opd-hint">Le serveur reçoit en plus op_na_D0elt' + esc(id) + '=1 quand N/A est coché.</p></div>' +
        '<div class="opd-sec" style="--c:#7A4E9E"><h5>Total calculé</h5><label class="opd-ck"><input type="checkbox" id="opdSumOn"' + (el.hasAttribute('data-op-sum') ? ' checked' : '') + '>Ce champ est la somme d’autres champs</label><div class="opd-chips" id="opdSum" style="' + (el.hasAttribute('data-op-sum') ? '' : 'display:none') + '">' +
        placedFields().filter(function (f) { return f !== el; }).map(function (f) { var n = attr(f, 'name'), on = (',' + attr(el, 'data-op-sum') + ',').indexOf(',' + n + ',') > -1; return '<label><input type="checkbox" value="' + esc(n) + '"' + (on ? ' checked' : '') + '>' + esc(attr(f, 'title') || n) + '</label>'; }).join('') + '</div></div>';
    }
    h += '<div class="opd-sec" style="--c:#7A4E9E"><h5>Afficher seulement si</h5><div class="opd-f"><select id="opdCId">' + condSel + '</select></div>' +
      '<div class="opd-row" style="margin-top:8px"><div class="opd-f"><select id="opdCOp">' + ['==', '!=', '>', '<', '>=', '<='].map(function (o) { return '<option' + (cp.op === o ? ' selected' : '') + ' value="' + o + '">' + ({ '==': 'est égal à', '!=': 'est différent de', '>': 'est plus grand que', '<': 'est plus petit que', '>=': 'est au moins', '<=': 'est au plus' }[o]) + '</option>'; }).join('') + '</select></div><div class="opd-f"><input id="opdCVal" value="' + esc(cp.val) + '" placeholder="valeur"></div></div>' +
      '<p class="opd-hint">' + (isSec ? 'Toute la section (jusqu’à la suivante) sera masquée si la condition n’est pas remplie.' : 'S’applique à la ligne qui contient ce champ.') + '</p></div>';
    if (!isSec) h += '<button type="button" class="opd-link" id="opdDel">Retirer ce champ du formulaire</button>';
    h += '</div>';
    drawer.innerHTML = h; drawer.classList.add('on'); document.body.classList.add('opd-open');
    $('.opd-x', drawer).addEventListener('click', closeDrawer);
    /* liaisons */
    $$('[data-k]', drawer).forEach(function (c) { c.addEventListener('change', function () { ed().dom.setAttrib(curEl, c.dataset.k, c.checked ? '1' : null);   /* TinyMCE retire un attribut vide : on écrit 1 */ touched(); }); });
    $$('[data-v]', drawer).forEach(function (c) { c.addEventListener('change', function () { ed().dom.setAttrib(curEl, c.dataset.v, c.value === '' ? null : c.value); touched(); }); });
    var so = $('#opdSumOn', drawer); if (so) { so.addEventListener('change', function () { $('#opdSum', drawer).style.display = so.checked ? '' : 'none'; if (!so.checked) { ed().dom.setAttrib(curEl, 'data-op-sum', null); touched(); } }); $$('#opdSum input', drawer).forEach(function (c) { c.addEventListener('change', function () { var v = $$('#opdSum input:checked', drawer).map(function (x) { return x.value; }).join(','); ed().dom.setAttrib(curEl, 'data-op-sum', v || null); touched(); }); }); }
    var condUp = function () { var b = cp.blk; if (!b) return; var i = $('#opdCId', drawer).value; ed().dom.setAttrib(b, 'data-op-show-if', i ? 'D0elt' + i + $('#opdCOp', drawer).value + $('#opdCVal', drawer).value.trim() : null); touched(); };
    ['#opdCId', '#opdCOp', '#opdCVal'].forEach(function (s) { $(s, drawer).addEventListener('change', condUp); });
    var seg = $$('.opd-seg button', drawer); seg.forEach(function (b) { b.addEventListener('click', function () { seg.forEach(function (x) { x.classList.toggle('on', x === b); }); $('#opdChoices', drawer).style.display = b.dataset.t === 'sel' ? '' : 'none'; if (b.dataset.t === 'num' && curEl.tagName === 'SELECT') convert('num'); if (b.dataset.t === 'sel' && curEl.tagName !== 'SELECT') convert('sel'); }); });
    var PRE = { yn: '1=Oui\n0=Non', s5: '1=Très faible\n2=Faible\n3=Moyen\n4=Bon\n5=Très bon', sx: '1=Femme\n2=Homme' };
    $$('[data-p]', drawer).forEach(function (b) { b.addEventListener('click', function () { $('#opdOpts', drawer).value = PRE[b.dataset.p]; if (curEl.tagName === 'SELECT') convert('sel'); }); });
    var oa = $('#opdOpts', drawer); if (oa) oa.addEventListener('change', function () { if (curEl.tagName === 'SELECT') convert('sel'); });
    var del = $('#opdDel', drawer); if (del) del.addEventListener('click', function () { var e = ed(); e.dom.remove(curEl); touched(); closeDrawer(); toast('Champ retiré du formulaire.'); });
  }
  function convert(to) {
    var e = ed(), el = curEl, keep = {};
    ['name', 'title', 'class', 'data-op-required', 'data-op-na', 'data-op-label'].forEach(function (k) { if (el.hasAttribute(k)) keep[k] = el.getAttribute(k) || '1'; });
    var n;
    if (to === 'sel') {
      var lines = ($('#opdOpts', drawer).value || '1=Oui\n0=Non').split(/\n+/).map(function (l) { var m = l.split('='); return m.length > 1 ? [m[0].trim(), m.slice(1).join('=').trim()] : null; }).filter(function (x) { return x && x[0] !== '' && !isNaN(parseFloat(x[0])); });
      if (!lines.length) { toast('Chaque choix doit avoir une valeur numérique : ex. 1=Oui'); return; }
      n = e.dom.create('select', keep, lines.map(function (l) { return '<option value="' + esc(l[0]) + '">' + esc(l[1]) + '</option>'; }).join(''));
    } else { keep.type = 'number'; keep.value = '0'; n = e.dom.create('input', keep); }
    e.dom.replace(n, el); curEl = n; touched(); renderDrawer();
  }

  /* ------------------------------------------------------------------ règles de cohérence */
  function rulesBox(create) {
    var b = body(); var d = $('.op-rules', b);
    if (!d && create) { d = ed().dom.add(b, 'div', { 'class': 'op-rules', 'data-rules': '[]', contenteditable: 'false' }, 'Règles de cohérence du formulaire (invisibles à la saisie)'); }
    return d;
  }
  function getRules() { var d = rulesBox(false); if (!d) return []; try { return JSON.parse(d.getAttribute('data-rules') || '[]'); } catch (e) { return []; } }
  function setRules(r) { var d = rulesBox(true); ed().dom.setAttrib(d, 'data-rules', JSON.stringify(r)); if (!r.length) ed().dom.remove(d); touched(); badges(); }
  function ruleText(r) {
    var n = function (x) { return nameOf(String(x).replace('D0elt', '')); };
    if (r.type === 'sum') return n(r.target) + ' = ' + (r.parts || []).map(n).join(' + ');
    return n(r.a) + ({ lte: ' ≤ ', gte: ' ≥ ', eq: ' = ' }[r.type]) + n(r.b);
  }
  function openRules() {
    var f = placedFields(); if (f.length < 2) { toast('Placez au moins deux champs pour définir une règle de cohérence.'); return; }
    var opt = f.map(function (x) { return '<option value="' + esc(x.getAttribute('name')) + '">' + esc(x.getAttribute('title') || x.getAttribute('name')) + '</option>'; }).join('');
    var draw = function () {
      var r = getRules();
      return '<p class="opd-lab" style="margin-bottom:8px">Règles actives</p>' + (r.length ? '<ul class="opd-list">' + r.map(function (x, i) { return '<li class="' + (x.level === 'warn' ? 'warn' : 'ok') + '"><span><b>' + esc(ruleText(x)) + '</b><br><small>' + esc(x.label || '') + ' · ' + (x.level === 'warn' ? 'alerte' : 'bloquante') + '</small></span><button type="button" class="opd-link" data-del="' + i + '">Supprimer</button></li>'; }).join('') + '</ul>' : '<p class="opd-hint">Aucune règle pour l’instant.</p>');
    };
    var m = modal('Qualité des données', 'Règles de cohérence entre champs',
      '<div id="opdRL">' + draw() + '</div><hr style="border:0;border-top:1px solid #eef1f4;margin:16px 0">' +
      '<p class="opd-lab">Nouvelle règle</p><div class="opd-row"><div class="opd-f"><label>Type</label><select id="opdRT"><option value="sum">Total = somme des parties</option><option value="lte">A ne peut pas dépasser B (≤)</option><option value="gte">A doit être au moins B (≥)</option><option value="eq">A doit être égal à B</option></select></div><div class="opd-f"><label>Niveau</label><select id="opdRLv"><option value="err">Bloquante</option><option value="warn">Alerte (à confirmer)</option></select></div></div>' +
      '<div class="opd-row"><div class="opd-f"><label id="opdRAL">Total</label><select id="opdRA">' + opt + '</select></div><div class="opd-f" id="opdRBW" style="display:none"><label>B</label><select id="opdRB">' + opt + '</select></div></div>' +
      '<div class="opd-f" id="opdRPW"><label>Parties</label><div class="opd-chips" id="opdRP">' + f.map(function (x) { return '<label><input type="checkbox" value="' + esc(x.getAttribute('name')) + '">' + esc(x.getAttribute('title') || x.getAttribute('name')) + '</label>'; }).join('') + '</div></div>' +
      '<div class="opd-f" style="margin-top:8px"><label>Message affiché à l’agent</label><input id="opdRM" placeholder="ex. Le total doit être égal à filles + garçons"></div>',
      '<button type="button" class="opd-btn" data-close>Fermer</button><button type="button" class="opd-btn pri" id="opdRAdd">Ajouter la règle</button>');
    var t = $('#opdRT', m), sync = function () { var s = t.value === 'sum'; $('#opdRPW', m).style.display = s ? '' : 'none'; $('#opdRBW', m).style.display = s ? 'none' : ''; $('#opdRAL', m).textContent = s ? 'Total' : 'A'; };
    t.addEventListener('change', sync); sync();
    $('[data-close]', m).addEventListener('click', closeModal);
    m.addEventListener('click', function (e) { var d = e.target.closest('[data-del]'); if (!d) return; var r = getRules(); r.splice(+d.dataset.del, 1); setRules(r); $('#opdRL', m).innerHTML = draw(); });
    $('#opdRAdd', m).addEventListener('click', function () {
      var r = { type: t.value, level: $('#opdRLv', m).value, label: $('#opdRM', m).value.trim() };
      if (r.type === 'sum') { r.target = $('#opdRA', m).value; r.parts = $$('#opdRP input:checked', m).map(function (x) { return x.value; }).filter(function (x) { return x !== r.target; }); if (r.parts.length < 2) { toast('Choisissez au moins deux parties.'); return; } }
      else { r.a = $('#opdRA', m).value; r.b = $('#opdRB', m).value; if (r.a === r.b) { toast('Choisissez deux champs différents.'); return; } }
      if (!r.label) r.label = ruleText(r);
      var all = getRules(); all.push(r); setRules(all); $('#opdRL', m).innerHTML = draw(); $('#opdRM', m).value = ''; toast('Règle ajoutée.');
    });
  }

  /* ------------------------------------------------------------------ désagrégation */
  function openDisag() {
    var used = placedIds(), free = catalog().filter(function (c) { return !used[c.id]; });
    var m = modal('Construire', 'Tableau de désagrégation',
      '<div class="opd-row"><div class="opd-f"><label>Lignes (une par ligne)</label><textarea id="opdDR" rows="4">0-5 ans\n6-11 ans\n12-17 ans\n18 ans et +</textarea></div><div class="opd-f"><label>Colonnes (une par ligne)</label><textarea id="opdDC" rows="4">Filles\nGarçons</textarea></div></div>' +
      '<div class="opd-row"><div class="opd-f"><label>Titre de la première colonne</label><input id="opdDT" value="Tranche d’âge"></div><div class="opd-f"><label>&nbsp;</label><label class="opd-ck" style="margin:0"><input type="checkbox" id="opdDTot" checked>Colonne « Total » calculée</label></div></div>' +
      '<p class="opd-lab" style="margin-top:6px">Associez un élément de données à chaque case</p><div id="opdDG"></div><p class="opd-hint">Les cases vides sont ignorées. Les totaux se calculent seuls pendant la saisie.</p>',
      '<button type="button" class="opd-btn" data-close>Annuler</button><button type="button" class="opd-btn pri" id="opdDGo">Insérer le tableau</button>');
    var grid = function () {
      var R = $('#opdDR', m).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), C = $('#opdDC', m).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), k = 0;
      var h = '<table class="opd-grid"><tr><th></th>' + C.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
      R.forEach(function (r, i) { h += '<tr><th>' + esc(r) + '</th>' + C.map(function (c, j) { var pre = free[k++]; return '<td><select data-r="' + i + '" data-c="' + j + '">' + optList(pre ? pre.id : '', true, '— vide —') + '</select></td>'; }).join('') + '</tr>'; });
      $('#opdDG', m).innerHTML = h + '</table>'; m._R = R; m._C = C;
    };
    ['#opdDR', '#opdDC'].forEach(function (s) { $(s, m).addEventListener('change', grid); }); grid();
    $('[data-close]', m).addEventListener('click', closeModal);
    $('#opdDGo', m).addEventListener('click', function () {
      var R = m._R, C = m._C, tot = $('#opdDTot', m).checked, h = '<table><thead><tr><th>' + esc($('#opdDT', m).value) + '</th>' + C.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + (tot ? '<th>Total</th>' : '') + '</tr></thead><tbody>', n = 0;
      R.forEach(function (r, i) {
        var names = []; h += '<tr><td>' + esc(r) + '</td>';
        C.forEach(function (c, j) { var id = $('select[data-r="' + i + '"][data-c="' + j + '"]', m).value; if (id) { n++; names.push('D0elt' + id); h += '<td>' + fieldInput(id, nameOf(id), ' data-op-min="0" data-op-int="1"') + '</td>'; } else h += '<td>&nbsp;</td>'; });
        if (tot) h += '<td>' + (names.length ? '<input class="form-control" type="number" value="0" readonly="readonly" title="Total ' + esc(r) + '" data-op-sum="' + names.join(',') + '" />' : '&nbsp;') + '</td>';
        h += '</tr>';
      });
      if (!n) { toast('Associez au moins une case à un élément.'); return; }
      ed().insertContent(h + '</tbody></table><p>&nbsp;</p>'); touched(); closeModal(); toast('Tableau de désagrégation inséré (' + n + ' champ(s)).');
    });
  }

  /* ------------------------------------------------------------------ modèles */
  function openTpl() {
    var m = modal('Construire', 'Modèles de mise en page',
      '<div class="opd-tpl">' +
      '<button type="button" data-t="table"><b>Tableau simple</b><span>Élément / Valeur pour tous les éléments pas encore placés.</span></button>' +
      '<button type="button" data-t="quest"><b>Questionnaire</b><span>Une question par ligne, lisible sur téléphone.</span></button>' +
      '<button type="button" data-t="disag"><b>Désagrégation sexe × âge</b><span>Le tableau standard demandé par les bailleurs.</span></button>' +
      '<button type="button" data-t="field"><b>Fiche terrain complète</b><span>Identification + GPS, puis les données sur une deuxième page.</span></button>' +
      '</div>', '');
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return; var used = placedIds(), free = catalog().filter(function (c) { return !used[c.id]; }), t = b.dataset.t;
      if (t === 'disag') { closeModal(); openDisag(); return; }
      if (!free.length && t !== 'field') { toast('Tous les éléments sont déjà placés.'); return; }
      var h = '';
      if (t === 'table') h = '<table><thead><tr><th>Élément de donnée</th><th>Valeur</th></tr></thead><tbody>' + free.map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td>' + fieldInput(c.id, c.name) + '</td></tr>'; }).join('') + '</tbody></table><p>&nbsp;</p>';
      if (t === 'quest') h = free.map(function (c) { return '<p><strong>' + esc(c.name) + '</strong><br />' + fieldInput(c.id, c.name) + '</p>'; }).join('');
      if (t === 'field') h = '<h3 class="op-section">Identification</h3><p>Date de la visite, lieu et enquêteur sont enregistrés automatiquement.</p><div class="op-gps" contenteditable="false">Position GPS de la fiche (capturée par l’agent à la saisie)</div><hr class="op-page" /><h3 class="op-section">Données collectées</h3>' + (free.length ? '<table><tbody>' + free.map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td>' + fieldInput(c.id, c.name) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>&nbsp;</p>') + '<p>&nbsp;</p>';
      ed().insertContent(h); touched(); closeModal(); toast('Modèle inséré.');
    });
  }

  /* ------------------------------------------------------------------ import XLSForm / Excel */
  function loadXLSX(cb) { if (window.XLSX) return cb(); var s = document.createElement('script'); s.src = XLSX_URL; s.onload = cb; s.onerror = function () { toast('Impossible de charger le lecteur Excel (connexion ?).'); }; document.head.appendChild(s); }
  function openXls() {
    var m = modal('Construire', 'Importer un formulaire XLSForm (Kobo, ODK) ou Excel',
      '<label class="opd-drop"><input type="file" id="opdXF" accept=".xlsx,.xls,.csv">Choisir un fichier .xlsx, .xls ou .csv</label>' +
      '<p class="opd-hint">Feuille « survey » : colonnes type, name, label, required, constraint, relevant. Feuille « choices » : list_name, name, label. Chaque question est associée à un élément du jeu de données par son libellé ou son nom.</p><div id="opdXR"></div>', '');
    $('#opdXF', m).addEventListener('change', function () { var f = this.files[0]; if (!f) return; $('#opdXR', m).innerHTML = '<p class="opd-hint">Lecture du fichier…</p>'; loadXLSX(function () { var r = new FileReader(); r.onload = function (ev) { try { importBook(XLSX.read(ev.target.result, { type: 'array' }), m); } catch (e) { $('#opdXR', m).innerHTML = '<p class="opd-hint" style="color:#C2410C">Fichier illisible : ' + esc(e.message) + '</p>'; } }; r.readAsArrayBuffer(f); }); });
  }
  function importBook(wb, m) {
    var sh = function (n) { var k = wb.SheetNames.filter(function (x) { return norm(x) === n; })[0]; return k ? XLSX.utils.sheet_to_json(wb.Sheets[k], { defval: '' }) : null; };
    var rows = sh('survey') || XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }), chs = sh('choices') || [];
    var low = function (o) { var r = {}; Object.keys(o).forEach(function (k) { r[norm(k).replace(/ /g, '_').replace(/_english.*|_fr.*|_french.*/, '')] = o[k]; }); return r; };
    rows = rows.map(low); chs = chs.map(low);
    var lists = {}; chs.forEach(function (c) { var l = c.list_name || c.list || ''; if (!l) return; (lists[l] = lists[l] || []).push(c); });
    var cat = catalog(), byN = {}, map = {};
    var match = function (r) { var a = norm(r.label), b = norm(r.name); var c = cat.filter(function (x) { return norm(x.name) === a; })[0] || cat.filter(function (x) { return norm(x.name) === b; })[0] || cat.filter(function (x) { var n = norm(x.name); return a && (n.indexOf(a) > -1 || a.indexOf(n) > -1); })[0]; return c; };
    var html = '', ok = 0, todo = [], q = 0;
    var cons = function (s) { var o = {}; String(s || '').split(/\band\b|&&/).forEach(function (p) { var k = p.match(/\.\s*(>=|<=|>|<)\s*(-?[\d.]+)/); if (k) { if (k[1][0] === '>') o.min = k[2]; else o.max = k[2]; } }); return o; };
    var rel = function (s) { var k = String(s || '').match(/\$\{([^}]+)\}\s*(=|!=|>=|<=|>|<)\s*'?([^'\s)]+)'?/); if (!k || !map[k[1]]) return ''; return 'D0elt' + map[k[1]] + (k[2] === '=' ? '==' : k[2]) + k[3]; };
    rows.forEach(function (r) {
      var type = String(r.type || '').trim(), lab = r.label || r.name || ''; if (!type) return;
      if (/^begin[ _]group|^begin[ _]repeat/.test(type)) { var c0 = rel(r.relevant); html += '<h3 class="op-section"' + (c0 ? ' data-op-show-if="' + esc(c0) + '"' : '') + '>' + esc(lab || 'Section') + '</h3>'; return; }
      if (/^end/.test(type)) return;
      if (type === 'note') { html += '<p>' + esc(lab) + '</p>'; return; }
      if (type === 'geopoint') { html += '<div class="op-gps" contenteditable="false">Position GPS de la fiche</div>'; return; }
      if (/^(start|end|today|deviceid|calculate|username|phonenumber)$/.test(type)) return;
      q++; var el = match(r);
      if (!el) { todo.push(lab); html += '<p class="op-todo">À associer : ' + esc(lab) + ' (' + esc(type) + ')</p>'; return; }
      ok++; map[r.name] = el.id;
      var extra = ''; if (/^(yes|true|1)$/i.test(String(r.required))) extra += ' data-op-required="1"';
      var c = cons(r.constraint); if (c.min != null) extra += ' data-op-min="' + esc(c.min) + '"'; if (c.max != null) extra += ' data-op-max="' + esc(c.max) + '"';
      if (type === 'integer') extra += ' data-op-int="1"';
      var field;
      var sm = type.match(/^select_one\s+(\S+)/);
      if (sm) { var opts = (lists[sm[1]] || []).map(function (o, i) { var v = isNaN(parseFloat(o.name)) ? i + 1 : o.name; return '<option value="' + esc(v) + '">' + esc(o.label || o.name) + '</option>'; }).join('') || '<option value="1">Oui</option><option value="0">Non</option>';
        field = '<select class="form-control" name="D0elt' + esc(el.id) + '" title="' + esc(el.name) + '"' + extra + '>' + opts + '</select>'; }
      else field = fieldInput(el.id, el.name, extra);
      var cd = rel(r.relevant);
      html += '<p' + (cd ? ' data-op-show-if="' + esc(cd) + '"' : '') + '><strong>' + esc(lab) + '</strong>' + (r.hint ? '<br /><em>' + esc(r.hint) + '</em>' : '') + '<br />' + field + '</p>';
    });
    if (!q && !html) { $('#opdXR', m).innerHTML = '<p class="opd-hint" style="color:#C2410C">Aucune question trouvée : vérifiez la feuille « survey » et la colonne « type ».</p>'; return; }
    $('#opdXR', m).innerHTML = '<ul class="opd-list" style="margin-top:12px"><li class="ok"><span><b>' + ok + '</b> question(s) associée(s) à un élément</span></li>' + (todo.length ? '<li class="warn"><span><b>' + todo.length + '</b> à associer : ' + esc(todo.slice(0, 6).join(', ')) + (todo.length > 6 ? '…' : '') + '</span><a class="opd-link" style="color:#123A37" href="/dataelts/" target="_blank" rel="noopener">Créer les éléments</a></li>' : '') + '</ul>' +
      '<div class="opd-mf" style="margin:14px -20px -18px"><button type="button" class="opd-btn" data-close>Annuler</button><button type="button" class="opd-btn pri" id="opdXGo">Insérer dans le formulaire</button></div>';
    $('[data-close]', m).addEventListener('click', closeModal);
    $('#opdXGo', m).addEventListener('click', function () { ed().insertContent(html + '<p>&nbsp;</p>'); touched(); closeModal(); toast(ok + ' question(s) importée(s)' + (todo.length ? ', ' + todo.length + ' à associer (en rouge).' : '.')); });
  }

  /* ------------------------------------------------------------------ aperçu mobile et version papier */
  var BASE = 'body{font-family:Inter,system-ui,sans-serif;margin:0;padding:16px;color:#0b1220;font-size:15px;line-height:1.5}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #e4e8ee;padding:8px;text-align:left;vertical-align:top}th{background:#f8fafc}' +
    'input.form-control,select.form-control{box-sizing:border-box;width:100%;max-width:160px;height:42px;border:1px solid #d0d5dd;border-radius:10px;padding:0 10px;font:inherit;font-size:16px;background:#fff}' +
    'h3.op-section{margin:16px 0 8px;font-size:17px}.op-rules{display:none}.op-todo{color:#C2410C}button[type=submit]{margin-top:16px;width:100%;height:48px;border:0;border-radius:12px;background:#E48B0C;color:#fff;font-weight:800;font-size:15px}';
  function openMobile() {
    var html = ed().getContent();
    var doc = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + BASE + '</style></head><body><form onsubmit="event.preventDefault()" action="/apercu/">' + html + '<button type="submit">Envoyer la fiche</button></form><script src="' + esc(RUNTIME) + '"><\/script></body></html>';
    var m = modal('Contrôler', 'Aperçu sur téléphone (règles actives)', '<div class="opd-phone"><iframe title="Aperçu mobile"></iframe></div><p class="opd-hint" style="text-align:center">Testez la saisie : validations, conditions, totaux et pages fonctionnent comme pour l’agent.</p>', '');
    $('iframe', m).srcdoc = doc;
  }
  function openPaper() {
    var html = ed().getContent(), w = window.open('', '_blank'); if (!w) { toast('Autorisez les fenêtres pour imprimer.'); return; }
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    $$('select', tmp).forEach(function (s) { var span = document.createElement('span'); span.innerHTML = $$('option', s).map(function (o) { return '☐ ' + esc(o.textContent); }).join('&nbsp;&nbsp;&nbsp;'); s.replaceWith(span); });
    $$('input[name^="D0elt"], input[data-op-sum]', tmp).forEach(function (i) { var span = document.createElement('span'); span.className = 'box'; i.replaceWith(span); });
    $$('.op-gps', tmp).forEach(function (g) { g.textContent = 'Coordonnées GPS : ______________________'; });
    $$('.op-rules', tmp).forEach(function (r) { r.remove(); }); $$('hr.op-page', tmp).forEach(function (h) { h.outerHTML = '<div style="page-break-after:always"></div>'; });
    var title = (document.querySelector('#datasetForm h1') || {}).textContent || 'Formulaire';
    w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font-family:Arial,sans-serif;font-size:12pt;margin:18mm}h1{font-size:16pt;margin:0 0 4mm}.meta{display:flex;gap:10mm;margin-bottom:6mm;font-size:10pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:6px}.box{display:inline-block;width:28mm;height:8mm;border:1px solid #333;vertical-align:middle}h3{border-bottom:1px solid #333;padding-bottom:2mm}</style></head><body><h1>' + esc(title) + '</h1><div class="meta"><span>Date : ____ / ____ / ________</span><span>Lieu : ____________________</span><span>Enquêteur : ____________________</span></div>' + tmp.innerHTML + '<script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }

  /* ------------------------------------------------------------------ versions (sur cet ordinateur) */
  function vKey() { var i = $('input[name="edit_id"]'); return 'op-fd-versions:' + (i && i.value || 'nouveau'); }
  function getV() { try { return JSON.parse(localStorage.getItem(vKey()) || '[]'); } catch (e) { return []; } }
  function snapshot(label) { var e = ed(); if (!e) return; var v = getV(), c = e.getContent(); if (v[0] && v[0].c === c) return; v.unshift({ t: Date.now(), c: c, l: label || '' }); try { localStorage.setItem(vKey(), JSON.stringify(v.slice(0, 15))); } catch (x) {} }
  function openVersions() {
    var draw = function () { var v = getV(); return v.length ? '<ul class="opd-list">' + v.map(function (x, i) { var n = (x.c.match(/name="D0elt/g) || []).length; return '<li><span><b>' + new Date(x.t).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) + '</b>' + (x.l ? ' · ' + esc(x.l) : '') + '<br><small>' + n + ' champ(s)</small></span><button type="button" class="opd-btn" data-r="' + i + '">Restaurer</button></li>'; }).join('') + '</ul>' : '<p class="opd-hint">Aucune version pour l’instant. Une version est créée à chaque enregistrement.</p>'; };
    var m = modal('Contrôler', 'Versions du formulaire', '<div id="opdVL">' + draw() + '</div><p class="opd-hint">Les 15 dernières versions sont gardées sur cet ordinateur.</p>', '<button type="button" class="opd-btn dom" id="opdVS">Créer une version maintenant</button>');
    $('#opdVS', m).addEventListener('click', function () { snapshot('manuelle'); $('#opdVL', m).innerHTML = draw(); toast('Version enregistrée.'); });
    m.addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (!b) return; var v = getV()[+b.dataset.r]; if (!v || !confirm('Remplacer le contenu actuel par cette version ?')) return; snapshot('avant restauration'); ed().setContent(v.c); touched(); closeModal(); toast('Version restaurée : enregistrez pour la conserver.'); });
  }

  /* ------------------------------------------------------------------ vérification */
  function issues() {
    var b = body(); if (!b) return [];
    var out = [], f = placedFields(), names = {}, cat = catalog(), used = placedIds();
    var miss = cat.filter(function (c) { return !used[c.id]; }); if (miss.length) out.push(['warn', miss.length + ' élément(s) du jeu de données ne sont pas dans le formulaire', miss.slice(0, 5).map(function (c) { return c.name; }).join(', ')]);
    f.forEach(function (x) { var n = x.getAttribute('name'); names[n] = (names[n] || 0) + 1; });
    Object.keys(names).forEach(function (n) { if (names[n] > 1) out.push(['bad', '« ' + nameOf(n.slice(5)) + ' » apparaît ' + names[n] + ' fois', 'Deux champs enregistreraient la même donnée.']); });
    var exist = function (n) { return !!names[n]; };
    getRules().forEach(function (r) { var refs = r.type === 'sum' ? [r.target].concat(r.parts || []) : [r.a, r.b]; if (refs.some(function (x) { return !exist(x); })) out.push(['bad', 'Règle « ' + ruleText(r) + ' » : un champ n’est plus dans le formulaire', 'Supprimez ou recréez la règle.']); });
    $$('[data-op-show-if]', b).forEach(function (el) { var k = (el.getAttribute('data-op-show-if').match(/D0elt[\w-]+/) || [''])[0]; if (k && !exist(k)) out.push(['bad', 'Une condition dépend de « ' + nameOf(k.slice(5)) + ' », absent du formulaire', 'La ligne serait toujours masquée ou affichée par erreur.']); });
    $$('[data-op-sum]', b).forEach(function (el) { el.getAttribute('data-op-sum').split(',').forEach(function (k) { if (k && !exist(k)) out.push(['bad', 'Un total utilise « ' + nameOf(k.slice(5)) + ' », absent du formulaire', '']); }); });
    $$('.op-todo', b).forEach(function (el) { out.push(['bad', 'Question importée non associée : ' + el.textContent.replace('À associer : ', ''), 'Créez l’élément puis insérez-le, ou supprimez la ligne.']); });
    var noRule = f.filter(function (x) { return x.tagName === 'INPUT' && !x.hasAttribute('data-op-sum') && !x.hasAttribute('data-op-min') && !x.hasAttribute('data-op-max') && !x.hasAttribute('data-op-required'); });
    if (noRule.length) out.push(['warn', noRule.length + ' champ(s) sans aucune règle de validation', 'Ajoutez au moins un minimum (souvent 0) pour éviter les valeurs négatives.']);
    if ($$('hr.op-page', b).length && !$('h3.op-section', b)) out.push(['warn', 'Des pages sans titre de section', 'Les étapes s’afficheront « Partie 1, Partie 2… ».']);
    return out;
  }
  function openCheck() {
    var o = issues(), bad = o.filter(function (x) { return x[0] === 'bad'; }).length;
    modal('Contrôler', bad ? bad + ' problème(s) à corriger' : (o.length ? 'Quelques améliorations possibles' : 'Formulaire prêt'),
      o.length ? '<ul class="opd-list">' + o.map(function (x) { return '<li class="' + x[0] + '"><span><b>' + esc(x[1]) + '</b>' + (x[2] ? '<br><small>' + esc(x[2]) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>' : '<ul class="opd-list"><li class="ok"><span><b>Tout est en ordre.</b><br><small>Tous les éléments sont placés, sans doublon, et les règles sont cohérentes.</small></span></li></ul>', '');
  }
  function badges() { var r = $('#opdNR'), c = $('#opdNC'); if (r) r.textContent = getRules().length; if (c) { var o = issues(), n = o.filter(function (x) { return x[0] === 'bad'; }).length; c.textContent = n || o.length; c.className = 'opd-badge' + (n ? ' w' : ''); } }

  var ACTIONS = { section: insertSection, page: insertPage, gps: insertGps, props: function () { openProps(); }, rules: openRules, disag: openDisag, tpl: openTpl, xls: openXls, mobile: openMobile, paper: openPaper, versions: openVersions, check: openCheck };

  /* ------------------------------------------------------------------ démarrage */
  function hook(e) {
    if (e._opd) return; e._opd = 1;
    var ready = function () {
      try { e.dom.addStyle(EDITOR_CSS); } catch (x) {}
      buildBar(); badges();
      e.on('click', function (ev) { var t = ev.target; if (t && t.matches && (t.matches('[name^="D0elt"]') || t.matches('h3.op-section'))) openProps(t); });
      e.on('change keyup SetContent Undo Redo', function () { clearTimeout(e._opdT); e._opdT = setTimeout(badges, 250); if (curEl && !e.getBody().contains(curEl)) closeDrawer(); });
    };
    if (e.initialized) ready(); else e.on('init', ready);
  }
  function start() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); buildDrawer();
    if (!window.tinymce) return;
    tinymce.on('AddEditor', function (ev) { hook(ev.editor); });
    if (tinymce.activeEditor) hook(tinymce.activeEditor);
    var form = document.getElementById('datasetForm');
    if (form) form.addEventListener('submit', function () { snapshot('enregistrement'); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.OperaDesigner = { check: issues, open: ACTIONS };
})();
