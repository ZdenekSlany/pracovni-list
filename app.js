/* Pracovní list Fleetware – logika formuláře (vyplnění, validace, ukládání, odeslání). */
(function () {
  'use strict';

  var C = window.PL_CONFIG;
  var LS_DRAFT = 'pl.draft.v1';
  var LS_TECH = 'pl.tech.v1';

  // ---------------------------------------------------------------- pomocné funkce
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
    else el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO(offsetDays) {
    var d = new Date(); d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? (+m[3]) + '. ' + (+m[2]) + '. ' + m[1] : (iso || '');
  }
  function fmtDateTime(d) {
    return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function isoLocal(d) {
    var off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
    off = Math.abs(off);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' +
      pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + s + pad(Math.floor(off / 60)) + ':' + pad(off % 60);
  }
  function plural(n, one, few, many) { return n === 1 ? one : (n >= 2 && n <= 4 ? few : many); }
  function uid() { return Math.random().toString(36).slice(2, 8); }
  function newSheetId() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return 'PL-' + todayISO().replace(/-/g, '') + '-' + s;
  }
  function slug(s) {
    return String(s || '').normalize('NFD').replace(new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g'), '')
      .replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'x';
  }

  // ---------------------------------------------------------------- definice polí
  function needsNetwork() { return C.deviceTypesRequiringNetwork.indexOf(val('typ')) >= 0; }

  var PERIPH = [];
  (function () {
    var i;
    for (i = 1; i <= C.swinCount; i++) PERIPH.push({ key: 'swin' + i, label: 'SWIN' + i, kind: 'select', options: C.peripheralOptions, inline: true });
    for (i = 1; i <= C.comCount; i++) PERIPH.push({ key: 'com' + i, label: 'COM' + i, kind: 'select', options: C.peripheralOptions, inline: true });
    for (i = 1; i <= C.otherPeripheralCount; i++) PERIPH.push({ key: 'jine' + i, label: 'Jiné', name: 'Jiné ' + i, kind: 'text', inline: true });
  })();

  var CHECKS = C.checklist.map(function (label, i) {
    return { key: 'k' + (i + 1), label: label, kind: 'yesno', options: ['ANO', 'NE'], required: true };
  });

  var SECTIONS = [
    { id: 'zakazka', title: 'Zakázka', fields: [
      { key: 'zakazka', label: 'Zakázka číslo', kind: 'text', required: true },
      { key: 'cinnost', label: 'Prováděná činnost', kind: 'segment', options: C.activities, required: true }
    ] },
    { id: 'zarizeni', title: 'Zařízení', fields: [
      { key: 'typ', label: 'Typ zařízení', kind: 'segment', options: C.deviceTypes, required: true },
      { key: 'vyrobniCislo', label: 'Výrobní číslo', kind: 'text', required: true },
      { key: 'cisloSite', label: 'Číslo sítě', kind: 'text', required: needsNetwork },
      { key: 'ar', label: 'AR zařízení', kind: 'text', required: needsNetwork },
      { key: 'telefon', label: 'Telefonní číslo', help: 'Číslo SIM v zařízení', kind: 'tel', required: true, format: 'phone' },
      { key: 'apn', label: 'APN', kind: 'text', nocaps: true }
    ] },
    { id: 'zakaznik', title: 'Zákazník', fields: [
      { key: 'firma', label: 'Název firmy', kind: 'text', required: true },
      { key: 'misto', label: 'Místo zásahu', kind: 'text', required: true }
    ] },
    { id: 'vozidlo', title: 'Vozidlo / objekt', fields: [
      { key: 'vozidlo', label: 'Vozidlo (značka, typ)', kind: 'text', required: true },
      { key: 'spz', label: 'SPZ', kind: 'text', required: true, upper: true },
      { key: 'km', label: 'Stav km', kind: 'int', required: true, format: 'int' }
    ] },
    { id: 'prevzeti', title: 'Převzetí vozidla',
      note: 'Vozidlo (objekt) bylo převzato ve stavu, který odpovídal stáří a způsobu používání vozidla.',
      fields: [{ key: 'zavady', label: 'Případné závady', kind: 'textarea' }] },
    { id: 'material', title: 'Použitý materiál', fields: [], custom: 'material' },
    { id: 'popis', title: 'Popis práce', fields: [{ key: 'popis', label: 'Popis práce', kind: 'textarea' }] },
    { id: 'periferie', title: 'Periferie', fields: PERIPH, custom: 'periferie' },
    { id: 'poznamky', title: 'Poznámky k zásahu', fields: [
      { key: 'poznamky', label: 'Poznámky (odlišnosti, problémy)', kind: 'textarea' }
    ] },
    { id: 'kontrola', title: 'Výstupní kontrola', note: 'U každého bodu zvolte ANO nebo NE.', fields: CHECKS },
    { id: 'technik', title: 'Práci vykonal', fields: [
      { key: 'technik', label: 'Jméno technika', kind: 'text', required: true, autocomplete: 'name' },
      { key: 'technikFirma', label: 'Firma', kind: 'segment', options: C.companies },
      { key: 'datum', label: 'Datum', kind: 'date', required: true, format: 'date' },
      { key: 'casOd', label: 'Čas od', kind: 'time', required: true },
      { key: 'casDo', label: 'Čas do', kind: 'time', required: true, format: 'timeTo' },
      { key: 'dopravaKm', label: 'Dopravní náklady – km', kind: 'int', format: 'int' }
    ] },
    { id: 'prevzal', title: 'Za zákazníka převzal', fields: [
      { key: 'prevzal', label: 'Jméno', help: 'Jméno osoby, která servis převzala', kind: 'text', autocomplete: 'off' },
      { key: 'kopieEmail', label: 'Kopie zákazníkovi (e-mail)', help: 'Na tuto adresu pak můžete poslat kopii PDF.', kind: 'email', format: 'email' }
    ], custom: 'prevzal' }
  ];
  var CUSTOMER_FIELDS = SECTIONS[SECTIONS.length - 1].fields;

  // ---------------------------------------------------------------- stav
  var state = null;
  var saveTimer = null;

  function loadTech() {
    try { return JSON.parse(localStorage.getItem(LS_TECH)) || {}; } catch (e) { return {}; }
  }
  function saveTech() {
    try {
      localStorage.setItem(LS_TECH, JSON.stringify({ technik: val('technik'), technikFirma: val('technikFirma') }));
    } catch (e) { /* úložiště nedostupné */ }
  }
  function newState() {
    var t = loadTech();
    return {
      id: newSheetId(),
      v: { datum: todayISO(), technik: t.technik || '', technikFirma: t.technikFirma || '' },
      materials: [],
      touched: {},
      showAll: false,
      allPeriph: false
    };
  }
  function loadDraft() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_DRAFT));
      if (!s || typeof s !== 'object' || !s.v) return null;
      s.materials = Array.isArray(s.materials) ? s.materials : [];
      s.touched = s.touched || {};
      return s;
    } catch (e) { return null; }
  }
  function hasContent(s) {
    if (s.materials.length) return true;
    return Object.keys(s.v).some(function (k) {
      return ['datum', 'technik', 'technikFirma'].indexOf(k) < 0 && String(s.v[k] || '').trim() !== '';
    });
  }
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    try { localStorage.setItem(LS_DRAFT, JSON.stringify(state)); }
    catch (e) { toast('Rozpracovaný list se nepodařilo uložit v telefonu.'); }
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }

  function matByKey(key) {
    var p = key.split('.');
    var m = state.materials.filter(function (x) { return x.uid === p[1]; })[0];
    return m ? { m: m, prop: p[2] } : null;
  }
  function raw(key) {
    if (key.indexOf('mat.') === 0) { var r = matByKey(key); return r ? (r.m[r.prop] || '') : ''; }
    return state.v[key] || '';
  }
  function val(key) { return String(raw(key)).trim(); }
  function setVal(key, value, sourceEl) {
    if (key.indexOf('mat.') === 0) { var r = matByKey(key); if (r) r.m[r.prop] = value; }
    else state.v[key] = value;
    if (key === 'technik' || key === 'technikFirma') saveTech();
    $all('[data-bind="' + key + '"]').forEach(function (el) {
      if (el !== sourceEl && el.value !== value) { el.value = value; autosize(el); }
    });
    scheduleSave();
    refresh();
  }
  function touch(key) {
    if (!state.touched[key]) { state.touched[key] = true; scheduleSave(); }
    refresh();
  }

  // ---------------------------------------------------------------- validace
  function isReq(def) { return typeof def.required === 'function' ? !!def.required() : !!def.required; }

  function checkFormat(format, v) {
    switch (format) {
      case 'phone':
        var digits = v.replace(/\D/g, '').length;
        return /^\+?[\d ]+$/.test(v) && digits >= 9 && digits <= 15 ? '' : 'Jen číslice, mezery a úvodní +, 9 až 15 číslic';
      case 'int':
        return /^\d+$/.test(v) ? '' : 'Zadejte celé nezáporné číslo';
      case 'posint':
        return /^\d+$/.test(v) && parseInt(v, 10) > 0 ? '' : 'Zadejte celé kladné číslo';
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Zadejte platnou e-mailovou adresu';
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) return 'Zadejte platné datum';
        return v <= todayISO(1) ? '' : 'Datum může být nejvýše 1 den v budoucnosti';
      case 'timeTo':
        var from = val('casOd');
        return !from || v > from ? '' : 'Čas do musí být později než Čas od';
    }
    return '';
  }

  // Vrátí seznam problémů v pořadí formuláře a počty povinných polí.
  function computeIssues() {
    var issues = [], reqTotal = 0, reqDone = 0, stats = {};
    function check(def, secId, required) {
      var v = val(def.key), msg = '', missing = false;
      if (!v) { if (required) { msg = 'Povinné pole'; missing = true; } }
      else if (def.format) msg = checkFormat(def.format, v);
      if (required) { reqTotal++; stats[secId].req++; if (!msg) reqDone++; }
      if (v) stats[secId].filled++;
      if (msg) { issues.push({ key: def.key, section: secId, msg: msg, missing: missing }); stats[secId].bad++; }
    }
    SECTIONS.forEach(function (sec) {
      stats[sec.id] = { req: 0, bad: 0, filled: 0 };
      sec.fields.forEach(function (def) { check(def, sec.id, isReq(def)); });
      if (sec.custom === 'material') {
        state.materials.forEach(function (m) {
          var k = 'mat.' + m.uid, name = (m.name || '').trim();
          var anything = name || (m.qty || '').trim() || (m.note || '').trim();
          if (!anything) return;
          if (!name) {
            reqTotal++; stats[sec.id].req++; stats[sec.id].bad++; stats[sec.id].filled++;
            issues.push({ key: k + '.name', section: sec.id, msg: 'Vyberte název materiálu', missing: true });
            return;
          }
          stats[sec.id].filled++;
          if (name === C.materialOther) check({ key: k + '.other' }, sec.id, true);
          check({ key: k + '.qty', format: 'posint' }, sec.id, true);
        });
      }
    });
    return { issues: issues, reqTotal: reqTotal, reqDone: reqDone, stats: stats };
  }

  // ---------------------------------------------------------------- vykreslení polí
  function autosize(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = Math.max(76, el.scrollHeight + 2) + 'px';
  }

  function renderField(def, prefix) {
    prefix = prefix || 'i-';
    var id = prefix + def.key.replace(/\./g, '-');
    var cls = 'field' + (def.kind === 'yesno' ? ' yn' : '') + (def.inline ? ' inline' : '');
    var wrap = h('div', { 'class': cls, 'data-key': def.key });
    wrap._def = def;
    var star = h('span', { 'class': 'star', hidden: true }, ' *');
    var control;

    if (def.kind === 'segment' || def.kind === 'yesno') {
      wrap.appendChild(h('div', { 'class': 'label', id: id + '-l' }, def.label, star));
      control = h('div', { 'class': 'seg', role: 'group', 'aria-labelledby': id + '-l' });
      def.options.forEach(function (opt) {
        control.appendChild(h('button', {
          type: 'button', 'class': 'seg-btn', 'data-val': opt, 'aria-pressed': 'false',
          onclick: function () {
            var next = (val(def.key) === opt && !isReq(def)) ? '' : opt;
            state.touched[def.key] = true;
            setVal(def.key, next);
          }
        }, opt));
      });
      wrap.appendChild(control);
    } else {
      wrap.appendChild(h('label', { 'for': id }, def.label, star));
      if (def.kind === 'select') {
        control = h('select', { id: id, 'data-bind': def.key }, h('option', { value: '' }, '— nevybráno —'));
        def.options.forEach(function (o) { control.appendChild(h('option', { value: o }, o)); });
        // hodnota, která už v konfiguraci není, se neztratí
        if (raw(def.key) && def.options.indexOf(raw(def.key)) < 0) control.appendChild(h('option', { value: raw(def.key) }, raw(def.key)));
      } else if (def.kind === 'textarea') {
        control = h('textarea', { id: id, rows: '2', 'data-bind': def.key });
      } else {
        var a = { id: id, 'data-bind': def.key, autocomplete: def.autocomplete || 'off', enterkeyhint: 'next' };
        if (def.kind === 'tel') { a.type = 'tel'; a.inputmode = 'tel'; }
        else if (def.kind === 'int') { a.type = 'text'; a.inputmode = 'numeric'; a.pattern = '[0-9]*'; }
        else if (def.kind === 'email') { a.type = 'email'; a.inputmode = 'email'; a.autocapitalize = 'off'; a.autocorrect = 'off'; a.spellcheck = 'false'; }
        else if (def.kind === 'date') { a.type = 'date'; a.max = todayISO(1); }
        else if (def.kind === 'time') { a.type = 'time'; }
        else { a.type = 'text'; if (def.upper) { a.autocapitalize = 'characters'; a['class'] = 'upper'; } if (def.nocaps) a.autocapitalize = 'off'; }
        control = h('input', a);
      }
      control.value = raw(def.key);
      control.addEventListener(def.kind === 'select' ? 'change' : 'input', function () {
        var v = control.value;
        if (def.upper && v !== v.toUpperCase()) {
          var s = control.selectionStart, e = control.selectionEnd;
          v = control.value = v.toUpperCase();
          try { control.setSelectionRange(s, e); } catch (err) { /* nevadí */ }
        }
        if (def.kind === 'select') state.touched[def.key] = true;
        autosize(control);
        setVal(def.key, v, control);
        if (def.onchange) def.onchange();
      });
      control.addEventListener('blur', function () {
        if (control.tagName !== 'SELECT' && def.kind !== 'date' && def.kind !== 'time') {
          var t = control.value.trim();
          if (t !== control.value) { control.value = t; autosize(control); setVal(def.key, t, control); }
        }
        touch(def.key);
      });
      if (def.kind === 'time') {
        wrap.appendChild(h('div', { 'class': 'with-btn' }, control,
          h('button', { type: 'button', 'class': 'btn small', onclick: function () {
            control.value = nowHM(); state.touched[def.key] = true; setVal(def.key, control.value, control);
          } }, 'Teď')));
      } else {
        wrap.appendChild(control);
      }
    }
    if (def.help) wrap.appendChild(h('div', { 'class': 'help' }, def.help));
    wrap.appendChild(h('div', { 'class': 'err', hidden: true, role: 'alert' }));
    return wrap;
  }

  // ---------------------------------------------------------------- materiál
  function renderMaterials() {
    var list = $('#matList');
    if (!list) return;
    list.textContent = '';
    state.materials.forEach(function (m, i) {
      var k = 'mat.' + m.uid;
      list.appendChild(h('div', { 'class': 'card' },
        h('div', { 'class': 'card-head' },
          h('strong', null, 'Položka ' + (i + 1)),
          h('button', { type: 'button', 'class': 'link danger', onclick: function () { removeMaterial(m); } }, 'Smazat')),
        renderField({ key: k + '.name', label: 'Název', kind: 'select', options: C.materials }),
        renderField({ key: k + '.other', label: 'Název materiálu', kind: 'text', required: true,
          hiddenUnless: function () { return m.name === C.materialOther; } }),
        renderField({ key: k + '.qty', label: 'Množství (ks)', kind: 'int', required: function () { return !!m.name; } }),
        renderField({ key: k + '.note', label: 'Poznámka / umístění', kind: 'text' })
      ));
    });
    var full = state.materials.length >= C.maxMaterials;
    var btn = $('#matAdd');
    btn.disabled = full;
    btn.textContent = full ? 'Maximum ' + C.maxMaterials + ' položek' : '+ Přidat materiál';
  }
  function addMaterial() {
    if (state.materials.length >= C.maxMaterials) return;
    state.materials.push({ uid: uid(), name: '', other: '', qty: '', note: '' });
    renderMaterials(); scheduleSave(); refresh();
    var cards = $all('#matList .card');
    var sel = $('select', cards[cards.length - 1]);
    if (sel) sel.focus();
  }
  function removeMaterial(m) {
    function doRemove() {
      state.materials = state.materials.filter(function (x) { return x !== m; });
      renderMaterials(); scheduleSave(); refresh();
    }
    if ((m.name || m.qty || m.note || m.other || '').trim()) {
      modal({ title: 'Smazat položku materiálu?', text: 'Vyplněná položka se odstraní z listu.',
        actions: [{ label: 'Smazat', kind: 'danger', fn: doRemove }, { label: 'Ponechat' }] });
    } else doRemove();
  }

  // ---------------------------------------------------------------- periferie
  function renderPeripherals() {
    var box = $('#periphList');
    if (!box) return;
    box.textContent = '';
    var shown = PERIPH.filter(function (p) { return state.allPeriph || val(p.key); });
    shown.forEach(function (p) { box.appendChild(renderField(p)); });
    if (!shown.length) box.appendChild(h('p', { 'class': 'sec-note' }, 'Žádný vstup zatím není vyplněný.'));
    var filled = PERIPH.filter(function (p) { return val(p.key); }).length;
    $('#periphToggle').textContent = state.allPeriph
      ? 'Skrýt prázdné vstupy'
      : 'Zobrazit všechny vstupy (' + PERIPH.length + ')' + (filled ? ' – vyplněno ' + filled : '');
  }

  // ---------------------------------------------------------------- formulář
  function renderForm() {
    var main = $('#form');
    main.textContent = '';
    SECTIONS.forEach(function (sec) {
      var body = h('div', { 'class': 'sec-body' });
      if (sec.note) body.appendChild(h('p', { 'class': 'sec-note' }, sec.note));
      if (sec.custom === 'material') {
        body.appendChild(h('div', { id: 'matList' }));
        body.appendChild(h('button', { type: 'button', 'class': 'btn block', id: 'matAdd', onclick: addMaterial }, '+ Přidat materiál'));
      } else if (sec.custom === 'periferie') {
        body.appendChild(h('div', { id: 'periphList' }));
        body.appendChild(h('button', { type: 'button', 'class': 'btn block', id: 'periphToggle', onclick: function () {
          state.allPeriph = !state.allPeriph; renderPeripherals(); scheduleSave(); refresh();
        } }));
      } else {
        if (sec.custom === 'prevzal') {
          body.appendChild(h('button', { type: 'button', 'class': 'btn block', onclick: openCustomerSummary }, 'Shrnutí pro zákazníka'));
        }
        sec.fields.forEach(function (def) { body.appendChild(renderField(def)); });
      }
      var head = h('button', { type: 'button', 'class': 'sec-head', 'aria-expanded': 'true', onclick: function () {
        var c = el.classList.toggle('collapsed');
        head.setAttribute('aria-expanded', String(!c));
        if (!c) $all('textarea', el).forEach(autosize);
      } }, h('span', { 'class': 'sec-title' }, sec.title), h('span', { 'class': 'sec-status' }));
      var el = h('section', { 'class': 'sec', id: 's-' + sec.id }, head, body);
      main.appendChild(el);
    });
    renderMaterials();
    renderPeripherals();
    $all('textarea', main).forEach(autosize);
    refresh();
  }

  // Aktualizuje chyby, hvězdičky, stavy sekcí, ukazatel postupu a spodní lištu.
  function refresh() {
    if (!state) return;
    var res = computeIssues(), byKey = {};
    res.issues.forEach(function (i) { byKey[i.key] = i; });

    $all('.field').forEach(function (el) {
      var def = el._def, key = def.key, issue = byKey[key];
      var show = issue && (state.showAll || state.touched[key]);
      el.classList.toggle('invalid', !!show);
      var err = $('.err', el);
      err.hidden = !show;
      err.textContent = show ? issue.msg : '';
      var star = $('.star', el);
      if (star) star.hidden = !isReq(def);
      if (def.hiddenUnless) el.hidden = !def.hiddenUnless();
      var current = val(key);
      $all('.seg-btn', el).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-val') === current));
      });
    });

    SECTIONS.forEach(function (sec) {
      var st = res.stats[sec.id], badge = $('#s-' + sec.id + ' .sec-status');
      if (st.bad) {
        badge.className = 'sec-status bad';
        badge.textContent = st.bad === 1 ? 'chybí 1' : 'chybí ' + st.bad;
        if (!res.issues.some(function (i) { return i.section === sec.id && i.missing; })) badge.textContent = 'chyba';
      } else if (st.req || st.filled) {
        badge.className = 'sec-status ok'; badge.textContent = '✓';
      } else {
        badge.className = 'sec-status opt'; badge.textContent = 'volitelné';
      }
    });

    $('#tbOrder').textContent = val('zakazka') ? 'Zakázka ' + val('zakazka') : 'Nový pracovní list';
    $('#progText').textContent = 'Povinná pole ' + res.reqDone + '/' + res.reqTotal;
    $('#progBar').style.width = (res.reqTotal ? Math.round(100 * res.reqDone / res.reqTotal) : 0) + '%';
    $('.progress').classList.toggle('done', res.reqDone === res.reqTotal);

    var missing = res.issues.filter(function (i) { return i.missing; }).length;
    var wrong = res.issues.length - missing;
    var parts = [];
    if (missing) parts.push('Chybí ' + missing + ' ' + plural(missing, 'povinné pole', 'povinná pole', 'povinných polí'));
    if (wrong) parts.push(wrong + ' ' + plural(wrong, 'pole má chybu', 'pole mají chybu', 'polí má chybu'));
    var hint = $('#hint');
    hint.textContent = parts.length ? parts.join(' · ') : 'Vše vyplněno, list můžete odeslat';
    hint.classList.toggle('ok', !parts.length);
    $('#btnSend').disabled = res.issues.length > 0;
  }

  function jumpToFirstIssue() {
    state.showAll = true;
    var res = computeIssues();
    if (!res.issues.length) { refresh(); return; }
    var first = res.issues[0];
    if (first.section === 'periferie' && !state.allPeriph) { state.allPeriph = true; renderPeripherals(); }
    refresh();
    var sec = $('#s-' + first.section);
    if (sec.classList.contains('collapsed')) $('.sec-head', sec).click();
    var field = $('#form .field[data-key="' + first.key + '"]');
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.classList.remove('flash'); void field.offsetWidth; field.classList.add('flash');
    var ctl = $('input, select, textarea, button', field);
    if (ctl) { try { ctl.focus({ preventScroll: true }); } catch (e) { ctl.focus(); } }
  }

  // ---------------------------------------------------------------- dialogy a panely
  var toastTimer = null;
  function toast(text) {
    var t = $('#toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function modal(opts) {
    var back = h('div', { 'class': 'modal-back' });
    var box = h('div', { 'class': 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('h2', null, opts.title), opts.text ? h('p', null, opts.text) : null);
    opts.actions.forEach(function (a) {
      box.appendChild(h('button', { type: 'button', 'class': 'btn block ' + (a.kind || ''), onclick: function () {
        back.remove(); if (a.fn) a.fn();
      } }, a.label));
    });
    back.appendChild(box);
    document.body.appendChild(back);
    var b = $('button', box); if (b) b.focus();
  }

  var overlayEl = null;
  function showOverlay(title, body, footer) {
    closeOverlay();
    overlayEl = h('div', { 'class': 'overlay' },
      h('div', { 'class': 'ov-head' },
        h('button', { type: 'button', 'class': 'ov-back', onclick: closeOverlay }, '‹ Zpět'),
        h('div', { 'class': 'ov-title' }, title)),
      h('div', { 'class': 'ov-body' }, body),
      footer ? h('div', { 'class': 'ov-foot' }, footer) : null);
    document.body.appendChild(overlayEl);
    document.body.classList.add('noscroll');
    return overlayEl;
  }
  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.remove(); overlayEl = null;
    document.body.classList.remove('noscroll');
    refresh();
  }

  // ---------------------------------------------------------------- data listu
  function collect() {
    var d = { schemaVersion: C.schemaVersion, id: state.id, odeslano: new Date() };
    ['zakazka', 'cinnost', 'typ', 'vyrobniCislo', 'cisloSite', 'ar', 'telefon', 'apn', 'firma', 'misto', 'vozidlo', 'spz', 'km',
      'zavady', 'popis', 'poznamky', 'technik', 'technikFirma', 'datum', 'casOd', 'casDo', 'dopravaKm', 'prevzal', 'kopieEmail']
      .forEach(function (k) { d[k] = val(k); });
    d.spz = d.spz.toUpperCase();
    d.material = state.materials.filter(function (m) { return (m.name || '').trim(); }).map(function (m) {
      var other = m.name === C.materialOther;
      return { nazev: other ? (m.other || '').trim() : m.name, jiny: other, mnozstvi: parseInt(m.qty, 10) || 0, poznamka: (m.note || '').trim() };
    });
    d.periferie = PERIPH.map(function (p) { return { vstup: p.label, nazev: p.name || p.label, hodnota: val(p.key) }; });
    d.kontrola = CHECKS.map(function (c) { return { bod: c.label, vysledek: val(c.key) }; });
    d.kontrolaNe = d.kontrola.filter(function (k) { return k.vysledek === 'NE'; });
    return d;
  }

  function materialText(d) {
    return d.material.map(function (m) {
      return m.nazev + ' ' + m.mnozstvi + ' ks' + (m.poznamka ? ' (' + m.poznamka + ')' : '');
    }).join('; ');
  }

  function summaryNode(d) {
    var root = h('div', { 'class': 'summary' });
    function group(title, rows) {
      rows = rows.filter(function (r) { return r && r[1] !== '' && r[1] != null; });
      if (!rows.length) return;
      var g = h('div', { 'class': 'sum-group' }, h('h4', null, title));
      rows.forEach(function (r) { g.appendChild(h('div', { 'class': 'sum-row' }, h('span', null, r[0]), h('span', null, r[1]))); });
      root.appendChild(g);
    }
    group('Zakázka', [['Zakázka číslo', d.zakazka], ['Prováděná činnost', d.cinnost]]);
    group('Zařízení', [['Typ zařízení', d.typ], ['Výrobní číslo', d.vyrobniCislo], ['Číslo sítě', d.cisloSite],
      ['AR zařízení', d.ar], ['Telefonní číslo', d.telefon], ['APN', d.apn]]);
    group('Zákazník', [['Název firmy', d.firma], ['Místo zásahu', d.misto]]);
    group('Vozidlo / objekt', [['Vozidlo', d.vozidlo], ['SPZ', d.spz], ['Stav km', d.km], ['Případné závady', d.zavady]]);
    group('Použitý materiál', d.material.map(function (m, i) {
      return [(i + 1) + '. ' + m.nazev, m.mnozstvi + ' ks' + (m.poznamka ? ' · ' + m.poznamka : '')];
    }));
    group('Popis práce', [['Popis', d.popis]]);
    group('Periferie', d.periferie.map(function (p) { return [p.vstup, p.hodnota]; }));
    group('Poznámky k zásahu', [['Poznámky', d.poznamky]]);
    group('Výstupní kontrola', d.kontrola.map(function (k) {
      return [k.bod, k.vysledek ? h('span', { 'class': 'badge ' + (k.vysledek === 'NE' ? 'ne' : 'ano') }, k.vysledek) : h('span', { 'class': 'note' }, 'nevyplněno')];
    }));
    group('Práci vykonal', [['Technik', d.technik], ['Firma', d.technikFirma], ['Datum', fmtDate(d.datum)],
      ['Čas', d.casOd || d.casDo ? (d.casOd || '?') + ' – ' + (d.casDo || '?') : ''], ['Dopravní náklady', d.dopravaKm ? d.dopravaKm + ' km' : '']]);
    return root;
  }

  function openCustomerSummary() {
    var body = h('div', null,
      h('div', { 'class': 'panel' }, summaryNode(collect())),
      h('div', { 'class': 'panel' }, h('h3', null, 'Za zákazníka převzal'),
        h('p', { 'class': 'note' }, 'Nepovinné. Jméno potvrzuje převzetí, na e-mail lze poslat kopii PDF.'),
        CUSTOMER_FIELDS.map(function (def) { return renderField(def, 'o-'); })));
    showOverlay('Shrnutí pro zákazníka', body,
      h('button', { type: 'button', 'class': 'btn primary', onclick: closeOverlay }, 'Hotovo'));
    refresh();
  }

  // ---------------------------------------------------------------- výstupy
  function subjectOf(d) {
    return 'Pracovní list – ' + d.zakazka + ' – ' + d.spz + ' – ' + d.firma + ' – ' + fmtDate(d.datum);
  }
  function mailBody(d) {
    var ne = d.kontrolaNe;
    var lines = [
      'Pracovní list ' + d.zakazka,
      '',
      'Činnost: ' + d.cinnost,
      'Zařízení: ' + d.typ + ', výrobní číslo ' + d.vyrobniCislo,
      'Zákazník: ' + d.firma + ', ' + d.misto,
      'Vozidlo: ' + d.vozidlo + ', SPZ ' + d.spz,
      'Technik: ' + d.technik + (d.technikFirma ? ' (' + d.technikFirma + ')' : ''),
      'Datum a čas: ' + fmtDate(d.datum) + ', ' + d.casOd + '–' + d.casDo,
      'Výstupní kontrola: ' + (ne.length
        ? ne.length + ' ' + plural(ne.length, 'bod', 'body', 'bodů') + ' s výsledkem NE (' + ne.map(function (k) { return k.bod; }).join('; ') + ')'
        : 'všech ' + d.kontrola.length + ' bodů ANO'),
      '',
      'ID listu: ' + d.id
    ];
    return lines.join('\n');
  }
  function customerBody(d) {
    return 'Dobrý den,\n\nv příloze posíláme kopii pracovního listu k zakázce ' + d.zakazka + ' (vozidlo ' + d.spz + ', ' + fmtDate(d.datum) + ').\n\n' +
      d.technik + (d.technikFirma ? ', ' + d.technikFirma : '');
  }

  function toJSON(d) {
    var per = {};
    d.periferie.forEach(function (p) { per[p.nazev] = p.hodnota; });
    return JSON.stringify({
      schemaVersion: d.schemaVersion,
      id: d.id,
      odeslano: isoLocal(d.odeslano),
      zakazka: { cislo: d.zakazka, cinnost: d.cinnost },
      zarizeni: { typ: d.typ, vyrobniCislo: d.vyrobniCislo, cisloSite: d.cisloSite, arZarizeni: d.ar, telefonniCislo: d.telefon, apn: d.apn },
      zakaznik: { nazevFirmy: d.firma, mistoZasahu: d.misto },
      vozidlo: { vozidlo: d.vozidlo, spz: d.spz, stavKm: d.km === '' ? null : Number(d.km) },
      prevzetiVozidla: { pripadneZavady: d.zavady },
      material: d.material,
      popisPrace: d.popis,
      periferie: per,
      poznamky: d.poznamky,
      vystupniKontrola: d.kontrola,
      praciVykonal: { jmeno: d.technik, firma: d.technikFirma, datum: d.datum, casOd: d.casOd, casDo: d.casDo,
        dopravniNakladyKm: d.dopravaKm === '' ? null : Number(d.dopravaKm) },
      zaZakaznikaPrevzal: { jmeno: d.prevzal, kopieEmail: d.kopieEmail }
    }, null, 2);
  }

  function toCSV(d) {
    var cols = [
      ['ID listu', d.id], ['Odesláno', fmtDateTime(d.odeslano)], ['Verze formuláře', d.schemaVersion],
      ['Zakázka číslo', d.zakazka], ['Prováděná činnost', d.cinnost],
      ['Typ zařízení', d.typ], ['Výrobní číslo', d.vyrobniCislo], ['Číslo sítě', d.cisloSite], ['AR zařízení', d.ar],
      ['Telefonní číslo', d.telefon], ['APN', d.apn],
      ['Název firmy', d.firma], ['Místo zásahu', d.misto],
      ['Vozidlo', d.vozidlo], ['SPZ', d.spz], ['Stav km', d.km], ['Případné závady', d.zavady],
      ['Použitý materiál', materialText(d)], ['Popis práce', d.popis]
    ];
    d.periferie.forEach(function (p, i) {
      cols.push([p.nazev, p.hodnota]);
    });
    cols.push(['Poznámky k zásahu', d.poznamky]);
    d.kontrola.forEach(function (k) { cols.push([k.bod, k.vysledek]); });
    cols.push(['Počet bodů NE', String(d.kontrolaNe.length)],
      ['Technik', d.technik], ['Firma technika', d.technikFirma], ['Datum', d.datum], ['Čas od', d.casOd], ['Čas do', d.casDo],
      ['Dopravní náklady km', d.dopravaKm], ['Za zákazníka převzal', d.prevzal], ['Kopie zákazníkovi', d.kopieEmail]);
    function cell(s) {
      s = String(s == null ? '' : s).replace(/\r?\n/g, ' | ');
      if (/^[=@]/.test(s)) s = "'" + s; // Excel nesmí text vyhodnotit jako vzorec
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return String.fromCharCode(0xFEFF) + cols.map(function (c) { return cell(c[0]); }).join(';') + '\r\n' +
      cols.map(function (c) { return cell(c[1]); }).join(';') + '\r\n';
  }

  var libsPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = function () { reject(new Error('Nepodařilo se načíst ' + src)); };
      document.head.appendChild(s);
    });
  }
  function fetchBytes(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Nepodařilo se načíst ' + url);
      return r.arrayBuffer();
    });
  }
  function loadLibs() {
    if (!libsPromise) {
      libsPromise = Promise.all([
        loadScript('vendor/pdf-lib.min.js').then(function () { return loadScript('vendor/fontkit.umd.min.js'); }),
        fetchBytes('fonts/Rubik_400Regular.ttf'),
        fetchBytes('fonts/Rubik_700Bold.ttf')
      ]).then(function (r) { return { regular: r[1], bold: r[2] }; });
      libsPromise.catch(function () { libsPromise = null; });
    }
    return libsPromise;
  }

  function buildFiles() {
    var d = collect();
    var base = 'PL_' + slug(d.zakazka) + '_' + slug(d.spz) + '_' + d.datum;
    return loadLibs().then(function (fonts) {
      return window.PLPdf.build(d, { fonts: fonts, config: C, fmtDate: fmtDate, fmtDateTime: fmtDateTime });
    }).then(function (pdfBytes) {
      var json = toJSON(d);
      return {
        d: d,
        subject: subjectOf(d),
        body: mailBody(d),
        pdf: new File([pdfBytes], base + '.pdf', { type: 'application/pdf' }),
        csv: new File([toCSV(d)], base + '.csv', { type: 'text/csv' }),
        json: new File([json], base + '.json', { type: 'application/json' }),
        jsonTxt: new File([json], base + '.json.txt', { type: 'text/plain' })
      };
    });
  }

  // Vybere sadu příloh, kterou tento telefon umí sdílet. null = použije se záložní postup.
  function shareableSet(pack) {
    if (!navigator.share || !navigator.canShare) return null;
    var sets = [
      { files: [pack.pdf, pack.csv, pack.json], note: '' },
      { files: [pack.pdf, pack.csv, pack.jsonTxt], note: 'Tento telefon neumí sdílet soubor .json, data se proto přiloží jako .json.txt.' },
      { files: [pack.pdf, pack.csv], note: 'Tento telefon neumí sdílet soubor JSON. Sdílí se PDF a CSV, JSON lze stáhnout zvlášť.' }
    ];
    for (var i = 0; i < sets.length; i++) {
      try { if (navigator.canShare({ files: sets[i].files })) return sets[i]; } catch (e) { /* zkusí další */ }
    }
    return null;
  }

  function copyText(text) {
    function legacy() {
      var ta = h('textarea', { readonly: true, style: 'position:fixed;top:0;left:0;opacity:0' });
      ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(); });
    }
    return Promise.resolve(legacy());
  }

  function download(file) {
    var a = h('a', { href: URL.createObjectURL(file), download: file.name, style: 'display:none' });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
  }
  function downloadAll(files) {
    files.forEach(function (f, i) { setTimeout(function () { download(f); }, i * 400); });
  }
  function mailto(to, subject, body) {
    return 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function kb(n) { return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' kB' : (n / 1024 / 1024).toFixed(1) + ' MB'; }

  // ---------------------------------------------------------------- odeslání
  function openSend() {
    if (computeIssues().issues.length) { jumpToFirstIssue(); return; }
    saveNow();
    var d0 = collect();
    var status = h('div', { 'class': 'status' }, 'Připravuji přílohy (PDF, CSV, JSON)…');
    var stepsBox = h('div', null, status);
    var body = h('div', null,
      h('div', { 'class': 'panel' }, h('h3', null, 'Shrnutí listu'),
        h('pre', { 'class': 'mail-preview' }, mailBody(d0)),
        h('details', null, h('summary', { 'class': 'link', style: 'display:inline-flex;align-items:center' }, 'Zobrazit celý list'), summaryNode(d0))),
      stepsBox);
    var myOverlay = showOverlay('Odeslání listu', body);

    buildFiles().then(function (pack) {
      if (overlayEl !== myOverlay) return;
      stepsBox.textContent = '';
      stepsBox.appendChild(sendSteps(pack));
      copyText(C.recipientEmail); // první pokus; znovu se kopíruje při klepnutí na sdílení
    }).catch(function (e) {
      console.error(e);
      status.className = 'status error';
      status.textContent = 'Přílohy se nepodařilo vytvořit. ' + (e && e.message ? e.message : '') + ' Vraťte se zpět a zkuste to znovu.';
    });
  }

  function sendSteps(pack) {
    var d = pack.d;
    var set = shareableSet(pack);
    var all = [pack.pdf, pack.csv, pack.json];
    var total = all.reduce(function (s, f) { return s + f.size; }, 0);
    var after = h('div', { hidden: true });
    var root = h('div', null);

    function addressPanel(no, title, address, text) {
      return h('div', { 'class': 'panel' },
        h('h3', null, h('span', { 'class': 'step-no' }, String(no)), title),
        h('div', { 'class': 'addr' }, h('b', null, address),
          h('button', { type: 'button', 'class': 'btn small', onclick: function () {
            copyText(address).then(function (ok) { toast(ok ? 'Adresa je zkopírovaná' : 'Adresu se nepodařilo zkopírovat, opište ji ručně'); });
          } }, 'Kopírovat')),
        h('p', null, text));
    }
    function attempted() { after.hidden = false; after.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

    function share(files, title, text, address, fallback) {
      copyText(address);
      navigator.share({ files: files, title: title, text: text }).then(attempted, function (e) {
        if (e && e.name === 'AbortError') { attempted(); return; } // technik sdílení zavřel, může ho zopakovat
        console.error(e);
        toast('Sdílení se nepodařilo, použije se stažení příloh');
        fallback();
      });
    }
    function fallbackRadium() {
      downloadAll(all);
      setTimeout(function () { location.href = mailto(C.recipientEmail, pack.subject, pack.body); }, 1400);
      attempted();
    }
    function fallbackCustomer() {
      download(pack.pdf);
      setTimeout(function () { location.href = mailto(d.kopieEmail, pack.subject, customerBody(d)); }, 800);
    }

    // 1. adresa
    root.appendChild(addressPanel(1, 'Adresa RADIUM', C.recipientEmail,
      set ? 'Adresa se zkopíruje do schránky. V e-mailu ji vložte do pole Komu.'
          : 'V tomto prohlížeči se adresa i předmět předvyplní do nového e-mailu.'));

    // 2. přílohy + sdílení
    var list = h('ul', { 'class': 'files' });
    all.forEach(function (f) {
      list.appendChild(h('li', null,
        h('a', { href: '#', onclick: function (ev) { ev.preventDefault(); download(f); } }, f.name), h('span', null, kb(f.size))));
    });
    var p2 = h('div', { 'class': 'panel' },
      h('h3', null, h('span', { 'class': 'step-no' }, '2'), 'Přílohy a odeslání'),
      list, h('p', { 'class': 'note' }, 'Celkem ' + kb(total) + '. Klepnutím na název lze soubor stáhnout.'));
    if (set) {
      if (set.note) p2.appendChild(h('p', { 'class': 'note warn' }, set.note));
      p2.appendChild(h('button', { type: 'button', 'class': 'btn primary block', onclick: function () {
        share(set.files, pack.subject, pack.body, C.recipientEmail, fallbackRadium);
      } }, 'Otevřít sdílení'));
      p2.appendChild(h('p', { 'class': 'note' }, 'Vyberte svou poštovní aplikaci, vložte adresu do pole Komu a e-mail odešlete. Bez signálu počká ve složce K odeslání.'));
    } else {
      p2.appendChild(h('button', { type: 'button', 'class': 'btn primary block', onclick: fallbackRadium }, 'Stáhnout přílohy a otevřít e-mail'));
      p2.appendChild(h('p', { 'class': 'note' }, 'Tento prohlížeč neumí sdílet soubory. Přílohy se stáhnou do zařízení a otevře se nový e-mail, do kterého je připojíte ručně ze složky Stažené.'));
    }
    root.appendChild(p2);

    // 3. po sdílení
    if (d.kopieEmail) {
      var canPdf = false;
      try { canPdf = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [pack.pdf] })); } catch (e) { canPdf = false; }
      var pc = addressPanel(3, 'Kopie zákazníkovi', d.kopieEmail, 'Zákazník dostane jen PDF, bez CSV a JSON.');
      pc.appendChild(h('button', { type: 'button', 'class': 'btn block', onclick: function () {
        if (canPdf) share([pack.pdf], pack.subject, customerBody(d), d.kopieEmail, fallbackCustomer);
        else fallbackCustomer();
      } }, 'Poslat kopii zákazníkovi'));
      after.appendChild(pc);
    }
    after.appendChild(h('div', { 'class': 'panel' },
      h('h3', null, h('span', { 'class': 'step-no' }, d.kopieEmail ? '4' : '3'), 'Potvrzení'),
      h('p', null, 'Formulář nepozná, jestli e-mail opravdu odešel. Dokud to nepotvrdíte, zůstává list uložený v telefonu a sdílení můžete zopakovat.'),
      h('button', { type: 'button', 'class': 'btn success block', onclick: function () {
        modal({ title: 'E-mail jste odeslali?', text: 'Rozpracovaný list se z telefonu smaže a formulář se připraví na další zásah.',
          actions: [{ label: 'Ano, e-mail jsem odeslal', kind: 'success', fn: finishSheet }, { label: 'Ještě ne' }] });
      } }, 'E-mail jsem odeslal')));
    root.appendChild(after);
    return root;
  }

  function finishSheet() {
    saveTech();
    clearTimeout(saveTimer);
    try { localStorage.removeItem(LS_DRAFT); } catch (e) { /* nevadí */ }
    state = newState();
    closeOverlay();
    renderForm();
    window.scrollTo(0, 0);
    toast('Hotovo. Formulář je připravený na další zásah.');
  }

  function startNew() {
    clearTimeout(saveTimer);
    try { localStorage.removeItem(LS_DRAFT); } catch (e) { /* nevadí */ }
    state = newState();
    renderForm();
    window.scrollTo(0, 0);
  }
  function confirmNew() {
    modal({ title: 'Začít nový list?', text: 'Rozpracovaný list se smaže a nepůjde obnovit.',
      actions: [{ label: 'Smazat a začít nový', kind: 'danger', fn: startNew }, { label: 'Pokračovat v rozpracovaném' }] });
  }

  // ---------------------------------------------------------------- start
  function init() {
    var saved = loadDraft();
    if (saved && hasContent(saved)) {
      state = saved;
      renderForm();
      modal({ title: 'Máte rozpracovaný list',
        text: (val('zakazka') ? 'Zakázka ' + val('zakazka') + (val('spz') ? ', ' + val('spz').toUpperCase() : '') + '. ' : '') + 'Chcete v něm pokračovat?',
        actions: [{ label: 'Pokračovat v rozpracovaném listu', kind: 'primary' }, { label: 'Začít nový', fn: confirmNew }] });
    } else {
      state = newState();
      renderForm();
    }

    $('#hint').addEventListener('click', jumpToFirstIssue);
    $('#btnSend').addEventListener('click', openSend);
    $('#btnNew').addEventListener('click', function () {
      if (hasContent(state)) confirmNew(); else startNew();
    });
    window.addEventListener('pagehide', function () { if (saveTimer) saveNow(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && saveTimer) saveNow(); });

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Service worker', e); });
    }
  }

  init();
})();
