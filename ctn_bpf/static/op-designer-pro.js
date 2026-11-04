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
  .opd-pick{position:fixed;z-index:1700;width:440px;max-height:min(620px,calc(100vh - 24px));display:flex;flex-direction:column;background:#fff;border:1px solid #e4e8ee;border-radius:16px;box-shadow:0 24px 60px -28px rgba(15,27,45,.55);overflow:hidden;font-family:Inter,Segoe UI,sans-serif}
  .opd-pick-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:14px 16px 10px;border-bottom:1px solid #eef1f4}
  .opd-pick-h small{display:block;font-size:11.5px;font-weight:700;color:#667085}
  .opd-pick-h b{display:block;font-size:14.5px;color:#0b1220;line-height:1.3}
  .opd-pick-b{overflow:auto;padding:4px 12px 10px}
  .opd-pick-b>p{margin:10px 4px 6px;font-size:11px;font-weight:800;color:#98a2b3;letter-spacing:.06em;text-transform:uppercase}
  .opd-pick-g{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .opd-pick-g button{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #eef1f4;border-radius:11px;background:#fff;text-align:left;cursor:pointer;color:#344054}
  .opd-pick-g button i{width:28px;height:28px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#f2f4f7;color:#2B3A67;font-size:13px}
  .opd-pick-g button b{display:block;font-size:13px;color:#0b1220}
  .opd-pick-g button small{display:block;font-size:11px;color:#98a2b3;line-height:1.25}
  .opd-pick-g button:hover,.opd-pick-g button:focus-visible{border-color:#2B3A67;outline:none;background:#f7f8fb}
  .opd-pick-g button.on{border-color:var(--acc,#E48B0C);background:#FFF8EB}
  .opd-pick-g button.on i{background:var(--acc,#E48B0C);color:#fff}
  .opd-nat{display:inline-block;margin-top:4px;font-style:normal;font-size:11.5px;font-weight:700;color:#2B3A67;background:#EEF1F8;padding:1px 8px;border-radius:999px}
  .opd-pick-n{margin:12px 4px 4px!important;font-size:12px!important;font-weight:500!important;color:#667085!important;letter-spacing:0!important;text-transform:none!important;line-height:1.45}
  .opd-pick-n a{color:#2B3A67;font-weight:700}
  .opd-natb{display:inline-block;margin-left:6px;font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:999px;vertical-align:1px}
  .opd-natb.n-number{background:#EEF1F8;color:#2B3A67}.opd-natb.n-text{background:#F3ECF8;color:#7A4E9E}.opd-natb.n-date{background:#E8F4F1;color:#1F6F65}
  .opd-fix{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;padding:11px 14px;border-radius:12px;background:#FFF3EF;border:1px solid #FFC4B2;color:#9E351C;font-size:13px;line-height:1.45}
  .opd-fix[hidden]{display:none!important}
  .opd-fix.ok{background:#E8F4F1;border-color:#BFE3DA;color:#1F6F65}
  .opd-atoast{position:fixed;left:50%;bottom:64px;transform:translate(-50%,12px);z-index:2001;display:flex;align-items:center;gap:14px;padding:9px 10px 9px 16px;border-radius:12px;background:#0b1220;color:#fff;font-size:13px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;max-width:calc(100vw - 24px)}
  .opd-atoast.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
  .opd-atoast button{border:0;border-radius:8px;padding:6px 10px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap}
  .opd-atoast button:hover{background:rgba(255,255,255,.24)}
  .opd-fix.info{background:#F2F4F7;border-color:#E4E8EE;color:#475467}
  .opd-fix code{font-size:12px;background:#fff;padding:0 4px;border-radius:4px}
  .opd-fix-a{display:flex;gap:6px;flex-shrink:0}
  .opd-fix .opd-b.pri{background:#E35A33;border-color:#E35A33;color:#fff}
  .opd-pick-f{display:flex;justify-content:space-between;gap:10px;padding:9px 16px;border-top:1px solid #eef1f4;font-size:11.5px;color:#98a2b3}
  .opd-pick-f kbd{font:inherit;font-size:10.5px;padding:0 5px;border:1px solid #e4e8ee;border-radius:4px;background:#f9fafb;color:#475467}
  @media (max-width:900px){.opd-pick{left:8px!important;right:8px;bottom:8px;top:auto!important;width:auto}.opd-pick-f span:last-child{display:none}}
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
  .form-control[type=text],.form-control[type=tel],.form-control[type=email],textarea.form-control{width:240px!important;text-align:left!important}
  textarea.form-control{min-height:56px;font-weight:600!important;border:2px solid #276696;background:#f0f7ff;color:#276696;padding:6px;border-radius:4px}
  .form-control[type=date],.form-control[type=time]{width:150px!important}
  .form-control[data-op-type=gps]{background:#EEF7F5!important;border-color:#2A8A7D!important;color:#1F6F65!important}
  .form-control[data-op-type=multi]{background:#F3ECF8!important;border-color:#7A4E9E!important;color:#5B3A78!important}
  .indicSelector{cursor:pointer}
  .indicSelector:not(.op-in-row)::before{content:attr(title) " : ";font-weight:600;color:#9a3412;font-size:12px}
  .indicSelector::after{content:" ƒ";font-weight:800;color:#C98A1B}
  tr.op-ind-head td{background:#FFF8EB;color:#8A5F14;font-size:12.5px;letter-spacing:.02em}
  tr.op-ind-row td:first-child{color:#8A5F14;font-weight:600}
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
  /* ------------------------------------------------------------------ types de champ */
  var TYPES = [
    { k: 'num', g: 'Nombres', l: 'Nombre', i: 'fa-hashtag', d: 'Effectifs, quantités' },
    { k: 'int', g: 'Nombres', l: 'Nombre entier', i: 'fa-list-ol', d: 'Personnes, visites, séances' },
    { k: 'age', g: 'Nombres', l: 'Âge (années)', i: 'fa-user-clock', d: 'Entier de 0 à 120' },
    { k: 'pct', g: 'Nombres', l: 'Pourcentage', i: 'fa-percent', d: 'De 0 à 100 %' },
    { k: 'money', g: 'Nombres', l: 'Montant', i: 'fa-coins', d: 'En FCFA, jamais négatif' },
    { k: 'yesno', g: 'Choix', l: 'Oui / Non', i: 'fa-toggle-on', d: 'Enregistré 1 ou 0' },
    { k: 'choice', g: 'Choix', l: 'Liste de choix', i: 'fa-list', d: 'Une seule réponse' },
    { k: 'multi', g: 'Choix', l: 'Choix multiples', i: 'fa-list-check', d: 'Plusieurs réponses', txt: 1 },
    { k: 'scale', g: 'Choix', l: 'Échelle de 1 à 5', i: 'fa-star-half-stroke', d: 'Satisfaction, qualité' },
    { k: 'text', g: 'Texte', l: 'Texte court', i: 'fa-font', d: 'Nom, village, code', txt: 1 },
    { k: 'long', g: 'Texte', l: 'Texte long', i: 'fa-align-left', d: 'Observations', txt: 1 },
    { k: 'date', g: 'Date, heure et lieu', l: 'Date', i: 'fa-calendar-day', d: 'Jour / mois / année', txt: 1 },
    { k: 'time', g: 'Date, heure et lieu', l: 'Heure', i: 'fa-clock', d: 'hh:mm', txt: 1 },
    { k: 'gps', g: 'Date, heure et lieu', l: 'Coordonnées GPS', i: 'fa-location-crosshairs', d: 'Capturées par le téléphone', txt: 1 },
    { k: 'tel', g: 'Contact', l: 'Téléphone', i: 'fa-phone', d: 'Ex. 6XX XX XX XX', txt: 1 },
    { k: 'email', g: 'Contact', l: 'E-mail', i: 'fa-at', d: 'nom@exemple.org', txt: 1 }
  ];
  var TYPE = {}; TYPES.forEach(function (t) { TYPE[t.k] = t; });
  /* nature de l'élément de données (page Data elements : Nombre / Texte / Date) → types de champ compatibles.
     Le serveur range la valeur selon cette nature : un champ d'un autre type serait mal enregistré. */
  var FAMILY = { num: 'Number', int: 'Number', age: 'Number', pct: 'Number', money: 'Number', yesno: 'Number', choice: 'Number', scale: 'Number',
    multi: 'Text', text: 'Text', long: 'Text', time: 'Text', gps: 'Text', tel: 'Text', email: 'Text', date: 'Date' };
  var FAMILY_DEF = { Number: 'num', Text: 'text', Date: 'date' };
  var NATURE_FR = { Number: 'Nombre', Text: 'Texte', Date: 'Date' };
  function normNature(v) { v = String(v || '').trim(); if (!v) return ''; if (/num|nomb|int|float|dec/i.test(v)) return 'Number'; if (/date/i.test(v)) return 'Date'; if (/text|texte|char|str/i.test(v)) return 'Text'; return ''; }
  function natureOf(id) { var it = $('#section-de .element-item[data-id="' + id + '"]') || $$('#section-de .element-item').filter(function (x) { return ((($('.font-mono', x) || {}).textContent || '').replace('#', '').trim()) === String(id); })[0]; return it ? normNature(it.getAttribute('data-nature')) : ''; }
  function compatible(k, nat) { return !nat || FAMILY[k] === nat; }
  /* suggestion d'après le libellé de l'élément (toujours dans la nature de l'élément) */
  var GUESS = [[/t[ée]l[ée]phone|\bt[ée]l\b|\bportable\b|num[ée]ro de contact/i, 'tel'], [/e-?mail|courriel/i, 'email'], [/gps|coordonn|position|localisation|latitude|longitude/i, 'gps'],
    [/observation|commentaire|remarque|description|pr[ée]cis/i, 'long'], [/\bheure\b/i, 'time'], [/\bdate\b/i, 'date'],
    [/taux|pourcentage|proportion|%/i, 'pct'], [/(^|[^a-zà-ÿ])[âa]ge([^a-zà-ÿ]|$)/i, 'age'], [/montant|co[ûu]t|prix|budget|fcfa|d[ée]pense|recette/i, 'money'],
    [/^(nombre|nb|effectif|total)\b/i, 'int'], [/^(est-ce|y a-t-il|existe|disposez|avez)/i, 'yesno']];
  function guessType(name, nat) { for (var i = 0; i < GUESS.length; i++) if (GUESS[i][0].test(name || '') && compatible(GUESS[i][1], nat)) return GUESS[i][1]; return ''; }
  function defaultType(id) { var nat = natureOf(id), last = rememberedType(id); if (last && TYPE[last] && compatible(last, nat)) return last; return guessType(nameOf(id), nat) || FAMILY_DEF[nat] || 'num'; }
  var NUMERIC = { num: 1, int: 1, age: 1, pct: 1, money: 1 };
  var CHOICES_DEF = { choice: '1=Option 1\n2=Option 2\n3=Option 3', multi: '1=Option 1\n2=Option 2\n3=Option 3',
    yesno: '1=Oui\n0=Non', scale: '1=Très faible\n2=Faible\n3=Moyen\n4=Bon\n5=Très bon' };
  function parseChoices(txt) {
    return String(txt || '').split(/\n+|;/).map(function (l) { var m = l.split('='); return m.length > 1 ? [m[0].trim(), m.slice(1).join('=').trim()] : (l.trim() ? [null, l.trim()] : null); })
      .filter(Boolean).map(function (x, i) { return [x[0] === null || x[0] === '' ? String(i + 1) : x[0], x[1]]; });
  }
  function choicesOf(el) {
    if (el.tagName === 'SELECT') return $$('option', el).filter(function (o) { return o.value !== ''; }).map(function (o) { return o.value + '=' + o.textContent; }).join('\n');
    if (el.hasAttribute('data-op-choices')) return el.getAttribute('data-op-choices').split(';').join('\n');
    return '';
  }
  function typeOf(el) {
    var t = el.getAttribute('data-op-type'); if (t && TYPE[t]) return t;
    if (el.tagName === 'SELECT') { var v = $$('option', el).map(function (o) { return o.value; }).filter(Boolean).sort().join(','); return v === '0,1' ? 'yesno' : 'choice'; }
    if (el.tagName === 'TEXTAREA') return 'long';
    var ty = (el.getAttribute('type') || 'text').toLowerCase();
    if (ty === 'number') return el.hasAttribute('data-op-int') ? 'int' : 'num';
    return { date: 'date', time: 'time', tel: 'tel', email: 'email' }[ty] || 'text';
  }
  /* construit le champ d'un type donné ; « keep » = attributs à conserver (nom, libellé, obligatoire…) */
  function buildField(k, keep, choicesTxt) {
    var a = {}; Object.keys(keep || {}).forEach(function (x) { a[x] = keep[x]; });
    a['class'] = a['class'] || 'form-control'; a['data-op-type'] = k;
    var tag = 'input', inner = '', ch = function () { return parseChoices(choicesTxt || CHOICES_DEF[k] || ''); };
    switch (k) {
      case 'num': a.type = 'number'; a.value = '0'; break;
      case 'int': a.type = 'number'; a.value = '0'; a.step = '1'; a['data-op-int'] = '1'; break;
      case 'age': a.type = 'number'; a.step = '1'; a['data-op-int'] = '1'; a['data-op-min'] = a['data-op-min'] || '0'; a['data-op-max'] = a['data-op-max'] || '120'; a['data-op-unit'] = 'ans'; break;
      case 'pct': a.type = 'number'; a.step = 'any'; a['data-op-min'] = '0'; a['data-op-max'] = '100'; a['data-op-unit'] = '%'; break;
      case 'money': a.type = 'number'; a.step = 'any'; a['data-op-min'] = a['data-op-min'] || '0'; a['data-op-unit'] = 'FCFA'; break;
      case 'yesno': case 'choice': case 'scale':
        tag = 'select'; inner = '<option value="">— choisir —</option>' + ch().map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join(''); break;
      case 'multi': a.type = 'text'; a['data-op-choices'] = ch().map(function (o) { return o[0] + '=' + o[1]; }).join(';'); a.placeholder = 'Choix multiples'; break;
      case 'text': a.type = 'text'; a.maxlength = '255'; break;
      case 'long': tag = 'textarea'; a.rows = '3'; break;
      case 'date': a.type = 'date'; break;
      case 'time': a.type = 'time'; break;
      case 'gps': a.type = 'text'; a.placeholder = 'latitude, longitude'; break;
      case 'tel': a.type = 'tel'; a.placeholder = '6XX XX XX XX'; break;
      case 'email': a.type = 'email'; a.placeholder = 'nom@exemple.org'; break;
    }
    return { tag: tag, attrs: a, inner: inner };
  }
  function fieldHtml(k, id, name, choicesTxt) {
    var b = buildField(k, { name: 'D0elt' + id, title: name }, choicesTxt), at = Object.keys(b.attrs).map(function (x) { return ' ' + x + '="' + esc(b.attrs[x]) + '"'; }).join('');
    return b.tag === 'input' ? '<input' + at + ' />' : '<' + b.tag + at + '>' + b.inner + '</' + b.tag + '>';
  }
  /* remplace un champ placé par le même champ d'un autre type (nom, libellé, règles de base conservés) */
  function retype(el, k, choicesTxt) {
    var e = ed(), keep = {}, num = NUMERIC[k];
    ['name', 'title', 'class', 'data-op-required', 'data-op-na', 'data-op-label'].concat(num ? ['data-op-min', 'data-op-max', 'data-op-soft-min', 'data-op-soft-max', 'data-op-sum'] : [])
      .forEach(function (x) { if (el.hasAttribute(x)) keep[x] = el.getAttribute(x) || '1'; });
    if (k === 'pct' || k === 'money' || k === 'age') { delete keep['data-op-min']; delete keep['data-op-max']; }
    var b = buildField(k, keep, choicesTxt), n = e.dom.create(b.tag, b.attrs, b.inner);
    e.dom.replace(n, el); return n;
  }
  var TYPE_KEY = 'op-fd-type:';
  function rememberType(id, k) { try { localStorage.setItem(TYPE_KEY + id, k); } catch (x) {} }
  function rememberedType(id) { try { return localStorage.getItem(TYPE_KEY + id) || ''; } catch (x) { return ''; } }

  /* sélecteur de type à l'insertion d'un élément depuis la colonne de gauche */
  var pick;
  function closePick() { if (pick) { pick.remove(); pick = null; } }
  function openPick(anchor, id, name, done) {
    closePick();
    var last = rememberedType(id), groups = [], nat = natureOf(id), def = defaultType(id);
    var ok = TYPES.filter(function (t) { return compatible(t.k, nat); });
    if (ok.length === 1) { rememberType(id, ok[0].k); done(ok[0].k); return; }   /* ex. élément « Date » : un seul type possible */
    TYPES.forEach(function (t) { if (groups.indexOf(t.g) < 0) groups.push(t.g); });
    pick = document.createElement('div'); pick.className = 'opd-pick'; pick.setAttribute('role', 'dialog'); pick.setAttribute('aria-label', 'Type de champ');
    pick.innerHTML = '<div class="opd-pick-h"><div><small>Type de champ pour</small><b>' + esc(name) + '</b>' + (nat ? '<em class="opd-nat">Nature de l’élément : ' + esc(NATURE_FR[nat]) + '</em>' : '') + '</div><button type="button" class="opd-x" aria-label="Fermer">×</button></div><div class="opd-pick-b">' +
      groups.filter(function (g) { return TYPES.some(function (t) { return t.g === g && compatible(t.k, nat); }); }).map(function (g) { return '<p>' + esc(g) + '</p><div class="opd-pick-g">' + TYPES.filter(function (t) { return t.g === g && compatible(t.k, nat); }).map(function (t) {
        return '<button type="button" data-k="' + t.k + '" class="' + (t.k === def ? 'on' : '') + '"><i class="fas ' + t.i + '"></i><span><b>' + esc(t.l) + '</b><small>' + esc(t.k === last ? 'Votre dernier choix' : (t.k === def && t.k !== FAMILY_DEF[nat] ? 'Suggéré d’après le libellé' : t.d)) + '</small></span></button>'; }).join('') + '</div>'; }).join('') +
      (nat ? '<p class="opd-pick-n">Seuls les types compatibles avec la nature « ' + esc(NATURE_FR[nat]) + ' » sont proposés. Pour un autre type, changez la nature de l’élément dans <a href="/dataelts/" target="_blank" rel="noopener">Data elements</a>.</p>' : '') +
      '</div><div class="opd-pick-f"><span><kbd>Entrée</kbd> insérer · <kbd>Échap</kbd> annuler</span><span>Modifiable ensuite dans « Propriétés »</span></div>';
    document.body.appendChild(pick);
    var r = anchor ? anchor.getBoundingClientRect() : { right: 360, top: 120 }, w = pick.offsetWidth, h = pick.offsetHeight;
    if (innerWidth > 900) { pick.style.left = Math.min(r.right + 10, innerWidth - w - 12) + 'px'; pick.style.top = Math.max(12, Math.min(r.top - 20, innerHeight - h - 12)) + 'px'; }
    var choose = function (k) { closePick(); rememberType(id, k); done(k); };
    pick.addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) choose(b.dataset.k); if (e.target.closest('.opd-x')) closePick(); });
    var on = $('.opd-pick-g button.on', pick) || $('.opd-pick-g button', pick); setTimeout(function () { on.focus(); }, 20);
    pick.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closePick(); }
      var bs = $$('.opd-pick-g button', pick), i = bs.indexOf(document.activeElement);
      if (/^Arrow(Down|Right)$/.test(e.key)) { e.preventDefault(); (bs[i + 1] || bs[0]).focus(); }
      if (/^Arrow(Up|Left)$/.test(e.key)) { e.preventDefault(); (bs[i - 1] || bs[bs.length - 1]).focus(); }
    });
    setTimeout(function () { document.addEventListener('mousedown', function off(e) { if (pick && !pick.contains(e.target)) { closePick(); } document.removeEventListener('mousedown', off); }); }, 0);
  }
  /* on enrobe insertDE (déjà enrobée par la page : doublons, « Placé », brouillon) sans en changer le nom */
  /* champs déjà placés dont le type ne correspond plus à la nature de leur élément
     (ex. élément passé de Nombre à Texte après la conception du formulaire) */
  function mismatches() {
    return placedFields().map(function (f) { var id = f.getAttribute('name').slice(5), nat = natureOf(id), k = typeOf(f); return nat && !compatible(k, nat) ? { f: f, id: id, nat: nat, k: k, to: defaultType(id) } : null; }).filter(Boolean);
  }
  function fixTypes() {
    var m = mismatches(); if (!m.length) return 0;
    m.forEach(function (x) { if (x.f.isConnected) retype(x.f, x.to); });
    touched(); updateFixBar(); badges();
    toast(m.length + ' champ(s) corrigé(s) : pensez à enregistrer le formulaire.');
    return m.length;
  }
  var fixBar, autoFixed = 0;
  function autoFix() {
    var m = mismatches(); if (!m.length) { updateFixBar(); return; }
    m.forEach(function (x) { if (x.f.isConnected) retype(x.f, x.to); });
    autoFixed = m.length; touched(); updateFixBar(); badges();
  }
  function updateFixBar() {
    var host = document.querySelector('.editor-container'); if (!host) return;
    if (!fixBar) {
      fixBar = document.createElement('div'); fixBar.className = 'opd-fix'; fixBar.setAttribute('role', 'status'); host.insertAdjacentElement('beforebegin', fixBar);
      fixBar.addEventListener('click', function (e) { if (e.target.closest('[data-fix]')) fixTypes(); if (e.target.closest('[data-show]')) openCheck(); });
    }
    var items = $$('#section-de .element-item'), withNat = items.filter(function (it) { return normNature(it.getAttribute('data-nature')); }).length;
    if (items.length && !withNat) {
      fixBar.className = 'opd-fix info'; fixBar.hidden = false;
      fixBar.innerHTML = '<span><b>Nature des éléments non transmise au designer.</b> Le modèle DataElement n’expose ni <code>m_value_type</code> ni <code>m_fields_type</code> renseigné : tous les types restent proposés.</span>';
      return;
    }
    var m = mismatches();
    if (!m.length) {
      if (autoFixed) { fixBar.className = 'opd-fix ok'; fixBar.hidden = false;
        fixBar.innerHTML = '<span><b>' + autoFixed + ' champ(s) ajusté(s) à la nature de leur élément de données</b> à l’ouverture du formulaire. Enregistrez (Ctrl + S) pour l’appliquer à la saisie — Ctrl + Z pour annuler.</span>'; return; }
      fixBar.hidden = true; return; }
    var ex = m.slice(0, 3).map(function (x) { return '« ' + esc(nameOf(x.id)) + ' » : ' + esc(TYPE[x.k].l.toLowerCase()) + ' → ' + esc(TYPE[x.to].l.toLowerCase()); }).join(' · ');
    fixBar.className = 'opd-fix'; fixBar.hidden = false;
    fixBar.innerHTML = '<span><b>' + m.length + ' champ(s) ne correspondent plus à la nature de leur élément de données.</b> ' + ex + (m.length > 3 ? ' …' : '') + '</span>' +
      '<span class="opd-fix-a"><button type="button" class="opd-b" data-show>Détails</button><button type="button" class="opd-b pri" data-fix>Corriger automatiquement</button></span>';
  }
  function actionToast(text, label, fn) {
    var el = $('.opd-atoast'); if (!el) { el = document.createElement('div'); el.className = 'opd-atoast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = '<span></span><button type="button"></button>'; el.firstChild.textContent = text; el.lastChild.textContent = label;
    el.lastChild.onclick = function () { el.classList.remove('on'); fn(); };
    el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, 4200);
  }
  function natureBadges() {
    $$('#section-de .element-item').forEach(function (it) {
      var nat = normNature(it.getAttribute('data-nature')); if (!nat || $('.opd-natb', it)) return;
      var tag = $('.variable-tag', it); if (!tag) return;
      var b = document.createElement('span'); b.className = 'opd-natb n-' + nat.toLowerCase(); b.textContent = NATURE_FR[nat];
      (($('.fd-placed', it)) || tag).insertAdjacentElement('afterend', b);
    });
  }
  /* ---------- tableau existant : on y ajoute des lignes au même format ---------- */
  function fieldRowsOf(tbl) { return $$('tr', tbl).filter(function (tr) { return tr.closest('table') === tbl && $$('[name^="D0elt"], .indicSelector', tr).length === 1 && tr.cells.length >= 2; }); }
  function bestTable() {
    var b = body(); if (!b) return null;
    var tbls = $$('table', b).filter(function (t) { return !t.classList.contains('opd-grid') && fieldRowsOf(t).length; });
    tbls.sort(function (x, y) { return fieldRowsOf(y).length - fieldRowsOf(x).length; });
    return tbls[0] || null;
  }
  /* ligne modèle : première ligne « libellé | champ » du tableau ; la nouvelle ligne reprend ses cellules et leurs styles */
  function rowFrom(tpl, label, fieldHtmlStr, extraCls) {
    var e = ed(), tr = tpl.cloneNode(true);
    tr.removeAttribute('data-op-show-if'); tr.removeAttribute('data-mce-selected');
    var cells = [].slice.call(tr.cells), fi = cells.findIndex(function (c) { return c.querySelector('[name^="D0elt"], .indicSelector'); });
    var li = cells.findIndex(function (c, i) { return i !== fi; });
    cells.forEach(function (c, i) {
      if (i === fi) c.innerHTML = fieldHtmlStr;
      else if (i === li) setLabel(c, label);
      else c.innerHTML = '&nbsp;';
    });
    if (extraCls) tr.classList.add(extraCls);
    return tr;
  }
  /* remplace le texte d'un libellé en gardant sa mise en forme (<strong>, <b>, <span style>…) */
  function setLabel(box, label) {
    var w = box;
    while (w.children.length === 1 && w.textContent.trim() === w.children[0].textContent.trim() && !w.children[0].matches('[name^="D0elt"], .indicSelector, br')) w = w.children[0];
    if (w === box && box.querySelector('strong, b, label')) w = box.querySelector('strong, b, label');
    w.textContent = label;
  }
  /* bloc modèle du formulaire : ligne de tableau ou paragraphe « libellé + champ » */
  function blockOf2(f) { var tr = f.closest('tr'); if (tr) return tr; var b = body(), n = f; while (n && n.parentNode !== b) n = n.parentNode; return n && n !== b ? n : null; }
  function fieldsIn(el) { return $$('[name^="D0elt"], .indicSelector', el); }
  function templateBlock(except) {
    var refs = placedFields().filter(function (f) { return f !== except && !except.contains(f); });
    for (var i = 0; i < refs.length; i++) { var bl = blockOf2(refs[i]); if (bl && fieldsIn(bl).length === 1 && bl.textContent.replace(/\u00a0/g, ' ').trim()) return { block: bl, field: refs[i] }; }
    return null;
  }
  function blockFrom(tpl, label, node) {
    if (tpl.tagName === 'TR') { var tr = rowFrom(tpl, label, ''); var cells = [].slice.call(tr.cells), fi = [].slice.call(tpl.cells).findIndex(function (c) { return c.querySelector('[name^="D0elt"], .indicSelector'); }); (cells[fi] || cells[cells.length - 1]).innerHTML = ''; (cells[fi] || cells[cells.length - 1]).appendChild(node); return tr; }
    var cl = tpl.cloneNode(true); cl.removeAttribute('data-op-show-if');
    var old = fieldsIn(cl)[0]; if (old) old.parentNode.replaceChild(node, old); else cl.appendChild(node);
    $$('em, i:not(.fas):not(.fa)', cl).forEach(function (x) { x.remove(); });                 /* aide propre à l'ancienne question */
    $$('br', cl).forEach(function (br) { var p = br.previousSibling; while (p && p.nodeType === 3 && !p.textContent.trim()) p = p.previousSibling; if (p && p.nodeName === 'BR') br.remove(); });
    var lab = cl.querySelector('strong, b, label'); if (lab) lab.textContent = label; else { var t = document.createElement('strong'); t.textContent = label; cl.insertBefore(t, cl.firstChild); cl.insertBefore(document.createElement('br'), t.nextSibling); }
    return cl;
  }
  /* apparence : le nouveau champ reprend la classe et le style des champs existants */
  function matchLook(el) {
    var refs = placedFields().filter(function (f) { return f !== el; }); if (!refs.length) return;
    var same = refs.filter(function (f) { return f.tagName === el.tagName && f.type === el.type; })[0] || refs.filter(function (f) { return f.tagName === el.tagName; })[0] || refs[0];
    var cls = (same.getAttribute('class') || '').split(/\s+/).filter(function (c) { return c && !/^(opf-|op-err|op-warnf|op-filled|mce-)/.test(c); });
    var mine = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    cls.forEach(function (c) { if (mine.indexOf(c) < 0) mine.push(c); });
    ed().dom.setAttrib(el, 'class', mine.join(' '));
    var st = same.getAttribute('style'); if (st && same.tagName === el.tagName && same.type === el.type) ed().dom.setAttrib(el, 'style', st);
  }
  /* placement : un champ inséré à côté d'un autre, ou dans une ligne vide, prend sa propre ligne au format du formulaire */
  function adaptPlacement(el, name) {
    var e = ed(), b = body(); if (!e || !b || !el || !el.isConnected) return el;
    matchLook(el);
    var tpl = templateBlock(el); if (!tpl) return el;                                           /* formulaire vide : rien à imiter */
    var tr = el.closest('tr'), top = blockOf2(el), others = top ? fieldsIn(top).filter(function (f) { return f !== el; }) : [];
    var txt = top ? top.textContent.replace(/\u00a0/g, ' ').trim() : '';
    var lonely = !top || (!others.length && !txt);                                             /* paragraphe vide ou ligne sans libellé */
    if (tr && !others.length) return el;                                                       /* cellule choisie à la main : on respecte */
    if (!others.length && txt && !tr) return el;                                               /* l'utilisateur a écrit son libellé : on respecte */
    if (!others.length && !lonely) return el;
    var node = el; node.parentNode.removeChild(node);
    var nb = blockFrom(tpl.block, name, node);
    if (top && others.length) top.parentNode.insertBefore(nb, top.nextSibling);               /* à côté d'un champ : nouvelle ligne juste après */
    else if (top && lonely && top.tagName !== 'TR' && tpl.block.tagName !== 'TR') top.parentNode.replaceChild(nb, top);
    else { var all = $$(tpl.block.tagName === 'TR' ? 'tr' : '*', b).filter(function (x) { return blockOf2(x) === x && fieldsIn(x).length && x.tagName === tpl.block.tagName && x !== nb; }), last = all[all.length - 1] || tpl.block; last.parentNode.insertBefore(nb, last.nextSibling); if (top && lonely && !fieldsIn(top).length && top.parentNode) top.parentNode.removeChild(top); }
    return node;
  }
  function indicHtml(id, name, inRow) { return '<div class="indicSelector' + (inRow ? ' op-in-row' : '') + '" data-id="' + esc(id) + '" title="' + esc(name) + '" contenteditable="false">0.00</div>'; }
  function unplacedInd() { var b = body(), used = {}; if (b) $$('.indicSelector[data-id]', b).forEach(function (d) { used[d.getAttribute('data-id')] = 1; }); return catInd().filter(function (c) { return c.id && !used[c.id]; }); }
  function smartGrid() {
    var e = ed(), b = body(); if (!e || !b) return 0;
    var used = placedIds(), deTodo = catalog().filter(function (c) { return c.id && !used[c.id]; }), inTodo = unplacedInd();
    if (!deTodo.length && !inTodo.length) { toast('Tous les éléments et indicateurs sont déjà dans le formulaire.'); return 0; }
    var tbl = bestTable(), mode;
    e.undoManager.transact(function () {
      if (tbl) {
        /* 1. formulaire existant : lignes ajoutées après la dernière ligne de saisie, au même format */
        mode = 'existant';
        var rows = fieldRowsOf(tbl), tpl = rows.filter(function (r) { return $('[name^="D0elt"]', r); })[0] || rows[0], last = rows[rows.length - 1];
        var tplInd = rows.filter(function (r) { return $('.indicSelector', r); })[0] || tpl;
        var lastDe = rows.filter(function (r) { return $('[name^="D0elt"]', r); }).pop() || last, anchor = lastDe;
        deTodo.forEach(function (c) { var tr = rowFrom(tpl, c.name, fieldHtml(defaultType(c.id), c.id, c.name)); anchor.parentNode.insertBefore(tr, anchor.nextSibling); anchor = tr; var f = $('[name^="D0elt"]', tr); if (f) matchLook(f); });
        /* indicateurs : regroupés à la fin du tableau, après un intertitre */
        if (inTodo.length) {
          var endRow = fieldRowsOf(tbl).pop(), hasHead = $('tr.op-ind-head', tbl);
          if (!hasHead) {
            var hd = e.dom.create('tr', { 'class': 'op-ind-head' }, '<td colspan="' + Math.max(2, tpl.cells.length) + '"><strong>Résultats calculés automatiquement</strong></td>');
            endRow.parentNode.insertBefore(hd, endRow.nextSibling); endRow = hd;
          }
          inTodo.forEach(function (c) { var tr = rowFrom(tplInd, c.name, indicHtml(c.id, c.name, true), 'op-ind-row'); endRow.parentNode.insertBefore(tr, endRow.nextSibling); endRow = tr; });
        }
      } else {
        /* 2. aucun tableau de saisie : un tableau propre, placé à la fin du formulaire (avant les règles) */
        mode = 'nouveau';
        var h = '<table class="op-grid-auto" style="width:100%"><thead><tr><th>Élément de donnée</th><th>Valeur</th></tr></thead><tbody>';
        deTodo.forEach(function (c) { h += '<tr><td>' + esc(c.name) + '</td><td>' + fieldHtml(defaultType(c.id), c.id, c.name) + '</td></tr>'; });
        if (inTodo.length) {
          h += '<tr class="op-ind-head"><td colspan="2"><strong>Résultats calculés automatiquement</strong></td></tr>';
          inTodo.forEach(function (c) { h += '<tr class="op-ind-row"><td>' + esc(c.name) + '</td><td>' + indicHtml(c.id, c.name, true) + '</td></tr>'; });
        }
        h += '</tbody></table>';
        var frag = e.dom.createFragment(h + '<p>&nbsp;</p>'), rb = $('.op-rules', b);
        if (rb) b.insertBefore(frag, rb); else b.appendChild(frag);
      }
    });
    touched(); badges();
    actionToast((deTodo.length ? deTodo.length + ' élément(s)' : '') + (deTodo.length && inTodo.length ? ' et ' : '') + (inTodo.length ? inTodo.length + ' indicateur(s)' : '') +
      (mode === 'existant' ? ' ajouté(s) dans votre tableau, au même format.' : ' ajouté(s) dans un nouveau tableau.'), 'Voir', function () {
        var f = $$('[name^="D0elt"], .indicSelector', body()).pop(); if (f) { f.scrollIntoView({ block: 'center' }); ed().selection.select(f); }
      });
    return deTodo.length + inTodo.length;
  }

  /* ---------- fiche d'un indicateur (clic dans le formulaire) ---------- */
  function openIndic(el) {
    var id = el.getAttribute('data-id'), it = catInd().filter(function (c) { return c.id === id; })[0], name = (it && it.name) || el.getAttribute('title') || 'Indicateur #' + id;
    curEl = null;
    var inRow = !!el.closest('tr.op-ind-row') || el.classList.contains('op-in-row');
    drawer.innerHTML = '<div class="opd-dh"><div><small>Indicateur calculé</small><b>' + esc(name) + '</b><code>#' + esc(id) + '</code></div><button type="button" class="opd-x" aria-label="Fermer">×</button></div><div class="opd-db">' +
      '<div class="opd-sec" style="--c:#C98A1B"><h5>À la saisie</h5><p class="opd-hint" style="color:#475467;font-size:12.5px">La valeur n’est pas saisie : elle est <b>calculée automatiquement</b> à partir de la formule de l’indicateur, à chaque frappe de l’agent. Elle apparaît aussi dans « Résultats calculés en direct » et sur la fiche papier.</p></div>' +
      '<div class="opd-sec" style="--c:#2B3A67"><h5>Présentation</h5>' + (inRow ? '<p class="opd-hint">Affiché sur sa propre ligne, avec son libellé.</p>' : '<button type="button" class="opd-b" id="opdIRow" style="border-color:#e4e8ee"><i class="fas fa-table-list"></i>Mettre sur sa propre ligne avec son libellé</button><p class="opd-hint">Recommandé : l’agent voit ce que représente le chiffre.</p>') + '</div>' +
      '<div class="opd-sec" style="--c:#2A8A7D"><h5>Formule</h5><p class="opd-hint">Pour la consulter ou la modifier : <a href="/indicateurs/" target="_blank" rel="noopener" style="color:#123A37;font-weight:700">page Indicateurs</a>.</p></div>' +
      '<button type="button" class="opd-link" id="opdIDel">Retirer cet indicateur du formulaire</button></div>';
    drawer.classList.add('on'); document.body.classList.add('opd-open');
    $('.opd-x', drawer).addEventListener('click', closeDrawer);
    var rowB = $('#opdIRow', drawer); if (rowB) rowB.addEventListener('click', function () {
      var e = ed(), tbl = bestTable(), rows = tbl ? fieldRowsOf(tbl) : [], tpl = rows[0];
      e.undoManager.transact(function () {
        var html = indicHtml(id, name, true);
        if (tpl) { var tr = rowFrom(tpl, name, html, 'op-ind-row'), host = el.closest('tr'); if (host && host.closest('table') === tbl) host.parentNode.insertBefore(tr, host.nextSibling); else rows[rows.length - 1].parentNode.insertBefore(tr, rows[rows.length - 1].nextSibling); }
        else e.dom.insertAfter(e.dom.createFragment('<table style="width:100%"><tbody><tr class="op-ind-row"><td>' + esc(name) + '</td><td>' + html + '</td></tr></tbody></table>'), el.closest('p') || el);
        e.dom.remove(el);
      });
      touched(); closeDrawer(); toast('Indicateur placé sur sa ligne.');
    });
    $('#opdIDel', drawer).addEventListener('click', function () { var tr = el.closest('tr.op-ind-row'); ed().dom.remove(tr || el); touched(); closeDrawer(); toast('Indicateur retiré du formulaire.'); });
  }

  /* insertion d'un indicateur depuis la colonne de gauche : dans un tableau, il prend sa propre ligne */
  function wrapInsertInd() {
    var prev = window.insertIND; if (typeof prev !== 'function' || prev._opd) return;
    var w = function (id, name) {
      var e = ed(), node = e && e.selection.getNode(), tr = node && node.closest && node.closest('tr'), tbl = tr && tr.closest('table');
      var rows = tbl ? fieldRowsOf(tbl) : [];
      if (!rows.length) return prev.apply(this, arguments);          /* hors tableau : comportement d'origine */
      var before = $$('.indicSelector', body());
      prev.apply(this, arguments);                                   /* compteurs « Placé » de la page */
      var added = $$('.indicSelector', body()).filter(function (x) { return before.indexOf(x) < 0; })[0];
      e.undoManager.transact(function () {
        if (added) e.dom.remove(added);
        var row = rowFrom(rows[0], name, indicHtml(id, name, true), 'op-ind-row'); tr.parentNode.insertBefore(row, tr.nextSibling);
      });
      touched(); toast('« ' + name + ' » ajouté sur sa propre ligne : la valeur sera calculée à la saisie.');
    };
    w._opd = 1; window.insertIND = w;
  }

  function wrapInsert() {
    natureBadges(); wrapInsertInd();
    /* « Insérer les éléments non placés » : intégré au tableau existant (remplace la grille séparée) */
    var gbtn = document.getElementById('fdGridBtn');
    if (gbtn && !gbtn._opd) {
      gbtn._opd = 1;
      gbtn.addEventListener('click', function (ev) { ev.stopImmediatePropagation(); ev.preventDefault(); smartGrid(); }, true);
      var p = gbtn.parentNode && gbtn.parentNode.querySelector('p'); if (p) p.textContent = 'Ajoute les éléments et indicateurs manquants dans votre tableau existant, au même format (ou crée un tableau s’il n’y en a pas).';
      /* le bouton reste actif tant qu'un indicateur n'est pas placé */
      new MutationObserver(function () { if (gbtn.disabled && unplacedInd().length) gbtn.disabled = false; }).observe(gbtn, { attributes: true, attributeFilter: ['disabled'] });
    }
    var prevDE = window.insertDE; if (typeof prevDE !== 'function' || prevDE._opd) return;
    var anchorEl = null;
    document.addEventListener('mousedown', function (e) { var it = e.target.closest && e.target.closest('#section-de .element-item'); if (it) anchorEl = it; }, true);
    var shift = false;
    document.addEventListener('mousedown', function (e) { shift = !!(e.shiftKey || e.altKey); }, true);
    var w = function (id, name) {
      var self = this, args = arguments;
      if (!ed()) return prevDE.apply(self, args);
      var place = function (k) {
        var b = body(), before = b ? $$('[name="D0elt' + id + '"]', b) : [];
        prevDE.apply(self, args);                                   /* insertion d'origine (champ nombre) */
        var now = body() ? $$('[name="D0elt' + id + '"]', body()) : [], el = now.filter(function (x) { return before.indexOf(x) < 0; })[0];
        if (el) {
          var n = el;
          ed().undoManager.transact(function () { if (k !== 'num') n = retype(el, k); n = adaptPlacement(n, name); });
          touched(); try { var se = ed().selection; se.select(n); se.collapse(false); } catch (x) {}   /* curseur après le champ : la prochaine insertion ne le remplace pas */
        }
      };
      if (shift) { shift = false; openPick(anchorEl, id, name, place); return; }
      /* nature de l'élément (m_value_type) → type de champ, sans question */
      var k = defaultType(id), nat = natureOf(id);
      place(k);
      actionToast('« ' + name + ' » : champ ' + TYPE[k].l.toLowerCase() + (nat ? ' (nature ' + NATURE_FR[nat] + ')' : ''), 'Changer le type', function () {
        var f = $$('[name="D0elt' + id + '"]', body()).pop(); if (f) openProps(f);
      });
    };
    w._opd = 1; window.insertDE = w;
    /* grille automatique : chaque élément reprend le dernier type choisi pour lui */
    var gb = document.getElementById('fdGridBtn');
    var avant = [];
    if (false) gb.addEventListener('click', function () { setTimeout(function () {
      var n = 0; $$('input[name^="D0elt"]:not([data-op-type])', body()).filter(function (f) { return avant.indexOf(f) < 0; }).forEach(function (f) { var k = defaultType(f.getAttribute('name').slice(5)); if (k && k !== 'num') { retype(f, k); n++; } });
      if (n) { touched(); toast(n + ' champ(s) inséré(s) avec le type déjà choisi pour eux.'); } }, 30); });
  }

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
    var id = isSec ? '' : attr(el, 'name').slice(5), isSel = el.tagName === 'SELECT', cp = condParts(el), tk = isSec ? '' : typeOf(el), nat = isSec ? '' : natureOf(id), isNum = !!NUMERIC[tk], hasCh = tk === 'choice' || tk === 'multi' || tk === 'yesno' || tk === 'scale';
    var others = catalog().filter(function (c) { return c.id !== id; });
    var condSel = '<option value="">— toujours affiché —</option>' + others.map(function (c) { return '<option value="' + esc(c.id) + '"' + (cp.id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    var h = '<div class="opd-dh"><div><small>' + (isSec ? 'Section' : 'Champ de saisie') + '</small><b>' + esc(name) + '</b>' + (id ? '<code>D0elt' + esc(id) + '</code>' : '') + '</div><button type="button" class="opd-x" aria-label="Fermer">×</button></div><div class="opd-db">';
    if (!isSec) {
      var groups = []; TYPES.forEach(function (t) { if (groups.indexOf(t.g) < 0) groups.push(t.g); });
      h += '<div class="opd-sec" style="--c:#2B3A67"><h5>Type de champ</h5><div class="opd-f"><select id="opdType">' +
        groups.map(function (g) { return '<optgroup label="' + esc(g) + '">' + TYPES.filter(function (t) { return t.g === g; }).map(function (t) { var okT = compatible(t.k, nat); return '<option value="' + t.k + '"' + (t.k === tk ? ' selected' : '') + (okT || t.k === tk ? '' : ' disabled') + '>' + esc(t.l) + (okT ? ' — ' + esc(t.d) : ' (nature ' + esc(NATURE_FR[FAMILY[t.k]]) + ' requise)') + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></div>' +
        (nat ? '<p class="opd-hint" style="margin-top:-4px">Nature de l’élément : <b>' + esc(NATURE_FR[nat]) + '</b>' + (compatible(tk, nat) ? '' : ' — <span style="color:#C2410C;font-weight:700">ce type de champ ne correspond pas : la valeur risque d’être mal enregistrée.</span>') + '</p>' : '') +
        '<div class="opd-f" id="opdChoices" style="' + (hasCh ? '' : 'display:none') + '"><label>Choix proposés (une ligne : code=libellé)</label><textarea rows="4" id="opdOpts">' + esc(choicesOf(el) || CHOICES_DEF[tk] || '') + '</textarea>' +
        '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button type="button" class="opd-b" data-p="yn">Oui / Non</button><button type="button" class="opd-b" data-p="s5">Échelle 1 à 5</button><button type="button" class="opd-b" data-p="sx">Sexe</button><button type="button" class="opd-b" data-p="ag">Tranches d’âge</button></div></div>' +
        (nat ? '' : '<p class="opd-hint">' + (TYPE[tk] && TYPE[tk].txt ? '<b>Valeur envoyée : texte</b>' + (tk === 'multi' ? ' (codes séparés par « ; », ex. 1;3)' : tk === 'gps' ? ' (« latitude, longitude »)' : tk === 'date' ? ' (AAAA-MM-JJ)' : '') + '. Vérifiez que l’élément de données accepte ce type dans la page Data elements.' : '<b>Valeur envoyée : nombre</b>' + (hasCh ? ' (le code du choix)' : '') + '.') + '</p>') + '</div>';
      h += '<div class="opd-sec" style="--c:#E35A33"><h5>Validation</h5>' +
        '<label class="opd-ck"><input type="checkbox" data-k="data-op-required"' + (el.hasAttribute('data-op-required') ? ' checked' : '') + '>Réponse obligatoire</label>' +
        (!isNum ? '' : '<label class="opd-ck"><input type="checkbox" data-k="data-op-int"' + (el.hasAttribute('data-op-int') ? ' checked' : '') + '>Nombre entier uniquement</label>' +
        '<div class="opd-row"><div class="opd-f"><label>Minimum</label><input type="number" step="any" data-v="data-op-min" value="' + esc(attr(el, 'data-op-min')) + '" placeholder="ex. 0"></div><div class="opd-f"><label>Maximum</label><input type="number" step="any" data-v="data-op-max" value="' + esc(attr(el, 'data-op-max')) + '" placeholder="ex. 500"></div></div>' +
        '<p class="opd-hint" style="margin-top:-2px">Hors de ces bornes, la fiche ne peut pas être envoyée.</p>') + '</div>';
      if (isNum) h += '<div class="opd-sec" style="--c:#C98A1B"><h5>Alerte valeur inhabituelle</h5><div class="opd-row"><div class="opd-f"><label>Alerter si moins de</label><input type="number" step="any" data-v="data-op-soft-min" value="' + esc(attr(el, 'data-op-soft-min')) + '"></div><div class="opd-f"><label>Alerter si plus de</label><input type="number" step="any" data-v="data-op-soft-max" value="' + esc(attr(el, 'data-op-soft-max')) + '"></div></div><p class="opd-hint">La valeur est acceptée, mais l’agent doit la confirmer.</p></div>' +
        '<div class="opd-sec" style="--c:#2A8A7D"><h5>Non applicable</h5><label class="opd-ck"><input type="checkbox" data-k="data-op-na"' + (el.hasAttribute('data-op-na') ? ' checked' : '') + '>Proposer « N/A » (différent de 0)</label><p class="opd-hint">Le serveur reçoit en plus op_na_D0elt' + esc(id) + '=1 quand N/A est coché.</p></div>' + (!isNum ? '' :
        '<div class="opd-sec" style="--c:#7A4E9E"><h5>Total calculé</h5><label class="opd-ck"><input type="checkbox" id="opdSumOn"' + (el.hasAttribute('data-op-sum') ? ' checked' : '') + '>Ce champ est la somme d’autres champs</label><div class="opd-chips" id="opdSum" style="' + (el.hasAttribute('data-op-sum') ? '' : 'display:none') + '">' +
        placedFields().filter(function (f) { return f !== el; }).map(function (f) { var n = attr(f, 'name'), on = (',' + attr(el, 'data-op-sum') + ',').indexOf(',' + n + ',') > -1; return '<label><input type="checkbox" value="' + esc(n) + '"' + (on ? ' checked' : '') + '>' + esc(attr(f, 'title') || n) + '</label>'; }).join('') + '</div></div>');
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
    var ty = $('#opdType', drawer);
    if (ty) ty.addEventListener('change', function () { var k = ty.value; var keepCh = (k === 'choice' || k === 'multi') ? ($('#opdOpts', drawer).value.trim() || CHOICES_DEF[k]) : CHOICES_DEF[k]; curEl = retype(curEl, k, keepCh); rememberType(id, k); touched(); renderDrawer(); toast('Type changé : ' + TYPE[k].l + '.'); });
    var PRE = { yn: '1=Oui\n0=Non', s5: CHOICES_DEF.scale, sx: '1=Femme\n2=Homme', ag: '1=Moins de 5 ans\n2=5 à 14 ans\n3=15 à 24 ans\n4=25 à 49 ans\n5=50 ans et plus' };
    var applyCh = function () { var k = typeOf(curEl); if (k === 'yesno' || k === 'scale') k = 'choice'; if (k !== 'choice' && k !== 'multi') return; curEl = retype(curEl, k, $('#opdOpts', drawer).value); touched(); };
    $$('[data-p]', drawer).forEach(function (b) { b.addEventListener('click', function () { $('#opdOpts', drawer).value = PRE[b.dataset.p]; applyCh(); renderDrawer(); }); });
    var oa = $('#opdOpts', drawer); if (oa) oa.addEventListener('change', function () { applyCh(); });
    var del = $('#opdDel', drawer); if (del) del.addEventListener('click', function () { var e = ed(); e.dom.remove(curEl); touched(); closeDrawer(); toast('Champ retiré du formulaire.'); });
  }
  function convert(to) {
    if (to === 'sel' || to === 'num') { curEl = retype(curEl, to === 'sel' ? 'choice' : 'num', $('#opdOpts', drawer) ? $('#opdOpts', drawer).value : ''); touched(); renderDrawer(); return; }
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
      if (/^(start|end|today|deviceid|calculate|username|phonenumber|audit)$/.test(type)) return;
      q++; var el = match(r);
      if (!el) { todo.push(lab); html += '<p class="op-todo">À associer : ' + esc(lab) + ' (' + esc(type) + ')</p>'; return; }
      ok++; map[r.name] = el.id;
      var extra = ''; if (/^(yes|true|1)$/i.test(String(r.required))) extra += ' data-op-required="1"';
      var c = cons(r.constraint); if (c.min != null) extra += ' data-op-min="' + esc(c.min) + '"'; if (c.max != null) extra += ' data-op-max="' + esc(c.max) + '"';
      if (type === 'integer') extra += ' data-op-int="1"';
      var field;
      var sm = type.match(/^select_(one|multiple)\s+(\S+)/);
      var chTxt = sm ? (lists[sm[2]] || []).map(function (o, i) { var v = isNaN(parseFloat(o.name)) ? i + 1 : o.name; return v + '=' + (o.label || o.name); }).join('\n') : '';
      var xk = sm ? (sm[1] === 'multiple' ? 'multi' : 'choice') : ({ integer: 'int', decimal: 'num', text: 'text', date: 'date', time: 'time', datetime: 'date', geopoint: 'gps', range: 'int' }[type.split(/\s+/)[0]] || 'num');
      if (/telephone|phone|tel/i.test(r.name || '') && xk === 'text') xk = 'tel';
      if (/e.?mail/i.test(r.name || '') && xk === 'text') xk = 'email';
      if (xk === 'text' && /^(text)$/.test(type) && String(r.appearance || '').indexOf('multiline') > -1) xk = 'long';
      if (sm && sm[1] === 'one') {                     /* listes reconnues : Oui/Non (1/0) et échelle 1 à 5 */
        var cds = chTxt.split('\n').map(function (l) { return l.split('=')[0].trim(); }).sort().join(',');
        if (cds === '0,1') xk = 'yesno'; else if (cds === '1,2,3,4,5') xk = 'scale';
      }
      var nt = natureOf(el.id); if (nt && !compatible(xk, nt)) xk = FAMILY_DEF[nt];   /* la nature de l'élément l'emporte */
      if (xk === 'num' || xk === 'int') { var gx = guessType(lab, nt || 'Number'); if (gx === 'age' || gx === 'pct' || gx === 'money') xk = gx; }
      field = fieldHtml(xk, el.id, el.name, chTxt || undefined);
      if (c.min != null) field = field.replace(/ data-op-min="[^"]*"/, '');   /* la contrainte du XLSForm remplace la borne par défaut */
      if (c.max != null) field = field.replace(/ data-op-max="[^"]*"/, '');
      if (extra) field = field.replace(/(\s*\/?>)/, extra + '$1');
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
    placedFields().forEach(function (f) { var id = f.getAttribute('name').slice(5), nat = natureOf(id), k = typeOf(f); if (nat && !compatible(k, nat)) out.push(['bad', '« ' + nameOf(id) + ' » : champ ' + TYPE[k].l.toLowerCase() + ' pour un élément de nature ' + NATURE_FR[nat], 'Cliquez sur le champ puis choisissez un type ' + NATURE_FR[nat].toLowerCase() + ' dans « Type de champ », ou changez la nature dans Data elements.']); });
    getRules().forEach(function (r) { var refs = r.type === 'sum' ? [r.target].concat(r.parts || []) : [r.a, r.b]; if (refs.some(function (x) { return !exist(x); })) out.push(['bad', 'Règle « ' + ruleText(r) + ' » : un champ n’est plus dans le formulaire', 'Supprimez ou recréez la règle.']); });
    $$('[data-op-show-if]', b).forEach(function (el) { var k = (el.getAttribute('data-op-show-if').match(/D0elt[\w-]+/) || [''])[0]; if (k && !exist(k)) out.push(['bad', 'Une condition dépend de « ' + nameOf(k.slice(5)) + ' », absent du formulaire', 'La ligne serait toujours masquée ou affichée par erreur.']); });
    $$('[data-op-sum]', b).forEach(function (el) { el.getAttribute('data-op-sum').split(',').forEach(function (k) { if (k && !exist(k)) out.push(['bad', 'Un total utilise « ' + nameOf(k.slice(5)) + ' », absent du formulaire', '']); }); });
    $$('.op-todo', b).forEach(function (el) { out.push(['bad', 'Question importée non associée : ' + el.textContent.replace('À associer : ', ''), 'Créez l’élément puis insérez-le, ou supprimez la ligne.']); });
    var noRule = f.filter(function (x) { return x.tagName === 'INPUT' && NUMERIC[typeOf(x)] && !x.hasAttribute('data-op-sum') && !x.hasAttribute('data-op-min') && !x.hasAttribute('data-op-max') && !x.hasAttribute('data-op-required'); });
    if (noRule.length) out.push(['warn', noRule.length + ' champ(s) numérique(s) sans aucune règle de validation', 'Ajoutez au moins un minimum (souvent 0) pour éviter les valeurs négatives.']);
    if ($$('hr.op-page', b).length && !$('h3.op-section', b)) out.push(['warn', 'Des pages sans titre de section', 'Les étapes s’afficheront « Partie 1, Partie 2… ».']);
    return out;
  }
  function openCheck() {
    var o = issues(), bad = o.filter(function (x) { return x[0] === 'bad'; }).length, nm = mismatches().length;
    modal('Contrôler', bad ? bad + ' problème(s) à corriger' : (o.length ? 'Quelques améliorations possibles' : 'Formulaire prêt'),
      o.length ? '<ul class="opd-list">' + o.map(function (x) { return '<li class="' + x[0] + '"><span><b>' + esc(x[1]) + '</b>' + (x[2] ? '<br><small>' + esc(x[2]) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>' : '<ul class="opd-list"><li class="ok"><span><b>Tout est en ordre.</b><br><small>Tous les éléments sont placés, sans doublon, et les règles sont cohérentes.</small></span></li></ul>',
      nm ? '<button type="button" class="opd-btn pri" id="opdFixAll">Corriger les ' + nm + ' type(s) de champ</button>' : '');
    var fb = document.getElementById('opdFixAll'); if (fb) fb.addEventListener('click', function () { fixTypes(); closeModal(); });
  }
  function badges() { try { updateFixBar(); } catch (x) {} var r = $('#opdNR'), c = $('#opdNC'); if (r) r.textContent = getRules().length; if (c) { var o = issues(), n = o.filter(function (x) { return x[0] === 'bad'; }).length; c.textContent = n || o.length; c.className = 'opd-badge' + (n ? ' w' : ''); } }

  var ACTIONS = { section: insertSection, page: insertPage, gps: insertGps, props: function () { openProps(); }, rules: openRules, disag: openDisag, tpl: openTpl, xls: openXls, mobile: openMobile, paper: openPaper, versions: openVersions, check: openCheck };

  /* ------------------------------------------------------------------ démarrage */
  function hook(e) {
    if (e._opd) return; e._opd = 1;
    var ready = function () {
      try { e.dom.addStyle(EDITOR_CSS); } catch (x) {}
      buildBar(); badges(); wrapInsert(); setTimeout(autoFix, 300);
      e.on('click', function (ev) { var t = ev.target; if (!t || !t.matches) return; var ind = t.closest && t.closest('.indicSelector'); if (ind) { openIndic(ind); return; } if (t.matches('[name^="D0elt"]') || t.matches('h3.op-section')) openProps(t); });
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
  window.OperaDesigner = { check: issues, open: ACTIONS, types: TYPES, fieldHtml: fieldHtml };
})();