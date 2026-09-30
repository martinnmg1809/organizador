/* Organizador de espacios — interfaz y coordinación. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const tr = (k, p) => I18n.t(k, p);
  const STORE_KEY = 'organizador-espacios.v1';
  const MAX_ITEMS = 60000;
  const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#6b7a8f'];
  const AXIS_KEYS = { x: ['x', 'w'], y: ['y', 'h'], z: ['z', 'd'] };
  // Textos de cada eje (se leen en el idioma actual).
  const AXIS_TEXT = {};
  for (const a of ['x', 'y', 'z']) {
    Object.defineProperty(AXIS_TEXT, a, {
      enumerable: true,
      get: () => ({ view: tr(`axis.${a}.view`), dir: tr(`axis.${a}.dir`), name: tr(`axis.${a}.name`) })
    });
  }

  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, dec) => {
    dec = dec == null ? 2 : dec;
    const p = Math.pow(10, dec);
    return (Math.round(v * p) / p).toLocaleString(I18n.locale(), { maximumFractionDigits: dec });
  };
  const pct = v => fmt(v * 100, 1) + (I18n.lang === 'es' ? ' %' : '%');
  const unitName = u => (u === 'in' ? 'in' : u);
  function volText(v, unit) {
    const toM3 = { mm: 1e-9, cm: 1e-6, m: 1, in: 1.6387064e-5 }[unit] || 1e-6;
    const m3 = v * toM3;
    return m3 >= 0.1 ? `${fmt(m3, 3)} m³` : `${fmt(m3 * 1000, 2)} L`;
  }
  const kg = v => `${fmt(v, 2)} kg`;

  // ---- Estado --------------------------------------------------------------

  const example = () => ({
    unit: 'cm',
    container: { w: 100, h: 100, d: 100 },
    types: [
      { id: uid(), name: tr('ex.big'), w: 40, h: 30, d: 30, qty: '', weight: 6, rot: 'all', color: PALETTE[0], enabled: true },
      { id: uid(), name: tr('ex.medium'), w: 30, h: 20, d: 20, qty: '', weight: 3, rot: 'all', color: PALETTE[1], enabled: true },
      { id: uid(), name: tr('ex.small'), w: 15, h: 10, d: 15, qty: '', weight: 0.5, rot: 'all', color: PALETTE[2], enabled: true }
    ],
    maxWeight: '', tare: '',
    bins: { auto: true, n: 1 },
    mode: 'max', objective: 'volume', support: 0.75, time: 3
  });

  let config = null;
  const ui = { view: 'split', axis: 'y', layer: 0, layerMode: false, ghost: 0.12, solidBefore: false, bin: 0, lang: null };
  let result = null;       // último resultado (con snapshot de la configuración usada)
  let stale = false;
  let layerCache = {};
  let running = null;

  // ---- Persistencia --------------------------------------------------------

  let stored = null;
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      stored = JSON.parse(raw);
      if (stored.ui) Object.assign(ui, stored.ui);
    } catch (e) { stored = null; /* almacenamiento no disponible */ }
  }
  // La configuración se carga después de elegir idioma (los nombres de ejemplo dependen de él).
  function loadConfig() {
    config = example();
    if (!stored) return;
    try {
      if (stored.config) config = sanitizeConfig(stored.config);
      if (stored.result && (stored.result.bins || stored.result.items)) { result = normalizeResult(stored.result); stale = !!stored.stale; }
    } catch (e) { /* datos dañados: se ignoran */ }
  }

  let saveTimer = 0;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  }
  function save() {
    const base = { config, ui };
    try {
      const withResult = JSON.stringify(Object.assign({ result, stale }, base));
      if (withResult.length < 3.5e6) { localStorage.setItem(STORE_KEY, withResult); return; }
      localStorage.setItem(STORE_KEY, JSON.stringify(base));
    } catch (e) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(base)); } catch (e2) { /* sin almacenamiento */ }
    }
  }

  // Los resultados de versiones anteriores (un solo contenedor) se convierten
  // al formato de varios contenedores.
  function normalizeResult(r) {
    if (!r || r.bins) return r;
    r.bins = [{
      items: r.items, grouped: r.grouped, count: r.count, volume: r.volume, utilization: r.utilization, top: r.top,
      placed: r.placed, weight: r.weight || 0, cog: r.cog || null, cogOffset: r.cogOffset || 0,
      boundReached: r.boundReached, countBound: r.countBound
    }];
    delete r.items;
    Object.assign(r, { multi: true, nBins: 1, auto: false, target: 1, lowerBound: 1, weight: r.weight || 0 });
    r.leftover = r.requested.map((q, i) => (q == null || !isFinite(q) ? null : Math.max(0, q - r.placed[i])));
    r.complete = r.leftover.every(q => !q);
    return r;
  }

  function sanitizeConfig(c) {
    const d = example();
    const num = (v, def) => (isFinite(+v) && +v > 0 ? +v : def);
    const optNum = v => (v === '' || v == null || !isFinite(+v) || +v <= 0 ? '' : +v);
    const out = {
      unit: ['mm', 'cm', 'm', 'in'].includes(c.unit) ? c.unit : d.unit,
      container: {
        w: num(c.container && c.container.w, 100), h: num(c.container && c.container.h, 100), d: num(c.container && c.container.d, 100)
      },
      types: Array.isArray(c.types) ? c.types.map((t, i) => ({
        id: t.id || uid(),
        name: String(t.name == null ? tr('type.defaultName', { n: i + 1 }) : t.name).slice(0, 60),
        w: num(t.w, 10), h: num(t.h, 10), d: num(t.d, 10),
        qty: t.qty === '' || t.qty == null || !isFinite(+t.qty) ? '' : Math.max(0, Math.floor(+t.qty)),
        rot: ['all', 'upright', 'none'].includes(t.rot) ? t.rot : 'all',
        color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : PALETTE[i % PALETTE.length],
        enabled: t.enabled !== false,
        noStack: !!t.noStack,
        weight: optNum(t.weight),
        maxLoad: t.maxLoad === '' || t.maxLoad == null || !(+t.maxLoad >= 0) ? '' : +t.maxLoad
      })) : d.types,
      maxWeight: optNum(c.maxWeight),
      tare: optNum(c.tare),
      bins: {
        auto: !(c.bins && c.bins.auto === false),
        n: c.bins && +c.bins.n >= 1 ? Math.min(500, Math.floor(+c.bins.n)) : 1
      },
      mode: c.mode === 'fixed' ? 'fixed' : 'max',
      objective: c.objective === 'count' ? 'count' : 'volume',
      support: [0, 0.5, 0.75, 1].includes(+c.support) ? +c.support : 0.75,
      time: [1, 3, 5, 10, 30].includes(+c.time) ? +c.time : 3
    };
    return out;
  }

  // ---- Formulario ----------------------------------------------------------

  function setSegmented(el, value) {
    $$('button', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === value)));
  }

  function renderForm() {
    $('#unit').value = config.unit;
    $('#c-w').value = config.container.w;
    $('#c-h').value = config.container.h;
    $('#c-d').value = config.container.d;
    setSegmented($('#mode'), config.mode);
    $('#objective').value = config.objective;
    $('#support').value = String(config.support);
    $('#time').value = String(config.time);
    $('#c-maxw').value = config.maxWeight;
    $('#c-tare').value = config.tare;
    $('#bins-mode').value = config.bins.auto ? 'auto' : 'n';
    $('#bins-n').value = config.bins.n;
    renderStaticTexts();
    renderWeightInfo();
    renderModeHint();
    renderContainerInfo();
    renderTypes();
  }

  // Textos del HTML que llevan números o dependen del estado.
  function renderStaticTexts() {
    for (const o of $$('#support option[data-pct]')) o.textContent = tr('sup.pct', { p: o.dataset.pct });
    if (!running) $('#btn-run').textContent = tr('run.go');
  }

  function renderModeHint() {
    const fixed = config.mode === 'fixed';
    const auto = fixed && config.bins.auto;
    $('#bins-mode-row').hidden = !fixed;
    $('#bins-n-row').hidden = auto;
    $('#mode-hint').textContent = fixed
      ? tr(auto ? 'hint.fixedAuto' : 'hint.fixedN')
      : tr(config.bins.n > 1 ? 'hint.maxN' : 'hint.max');
    $('#objective-label').textContent = tr(fixed ? 'obj.prioFixed' : 'obj.prio');
  }

  function renderContainerInfo() {
    const C = config.container, u = unitName(config.unit);
    const V = C.w * C.h * C.d;
    $('#c-vol').textContent = V > 0 ? tr('c.vol', { v: fmt(V, 2), u, m: volText(V, config.unit) }) : tr('c.volEmpty');
  }

  const weightCap = () => (config.maxWeight > 0 ? Math.max(0, config.maxWeight - (+config.tare || 0)) : Infinity);

  function renderWeightInfo() {
    const el = $('#w-info');
    for (const b of $$('#weight-presets button')) b.setAttribute('aria-pressed', String(String(config.maxWeight) === b.dataset.w));
    const anyWeight = config.types.some(t => t.enabled && +t.weight > 0);
    if (!(config.maxWeight > 0)) {
      el.textContent = tr(anyWeight ? 'w.info.noLimit' : 'w.info.noWeights');
      return;
    }
    const cap = weightCap();
    el.textContent = config.tare > 0
      ? tr('w.info.capTare', { cap: kg(cap), max: kg(config.maxWeight), tare: kg(config.tare) })
      : tr('w.info.cap', { cap: kg(cap) });
    if (!anyWeight) el.textContent += tr('w.info.needWeights');
  }

  const ROT_OPTIONS = ['all', 'upright', 'none'];

  function renderTypes() {
    const wrap = $('#types');
    wrap.innerHTML = '';
    const fixed = config.mode === 'fixed';
    config.types.forEach(t => {
      const el = document.createElement('div');
      el.className = 'type-card' + (t.enabled ? '' : ' disabled');
      el.dataset.id = t.id;
      el.style.setProperty('--type-color', t.color);
      el.innerHTML = `
        <div class="type-head">
          <input type="color" class="type-color" data-k="color" value="${t.color}" aria-label="${tr('type.color')}" title="${tr('type.color')}">
          <input type="text" class="type-name" data-k="name" value="${esc(t.name)}" aria-label="${tr('type.name')}" maxlength="60">
          <label class="toggle" title="${tr('type.use.title')}"><input type="checkbox" data-k="enabled" ${t.enabled ? 'checked' : ''} aria-label="${tr('type.use')}"><span></span></label>
          <button type="button" class="icon-btn" data-act="del" title="${tr('type.del')}" aria-label="${tr('type.del')}">×</button>
        </div>
        <div class="type-dims">
          <label><span>${tr('dim.w')}</span><input type="number" min="0" step="any" inputmode="decimal" data-k="w" value="${t.w}"></label>
          <label><span>${tr('dim.h')}</span><input type="number" min="0" step="any" inputmode="decimal" data-k="h" value="${t.h}"></label>
          <label><span>${tr('dim.d')}</span><input type="number" min="0" step="any" inputmode="decimal" data-k="d" value="${t.d}"></label>
        </div>
        <div class="type-opts">
          <label><span>${tr(fixed ? 'type.qtyFixed' : 'type.qtyMax')}</span><input type="number" min="0" step="1" inputmode="numeric" data-k="qty" value="${t.qty === '' ? '' : t.qty}" placeholder="${fixed ? '0' : tr('noLimit')}"></label>
          <label title="${tr('type.weight.title')}"><span>${tr('type.weight')}</span><input type="number" min="0" step="any" inputmode="decimal" data-k="weight" value="${t.weight === '' || t.weight == null ? '' : t.weight}" placeholder="—"></label>
          <label><span>${tr('type.rot')}</span><select data-k="rot">${ROT_OPTIONS.map(v => `<option value="${v}" ${t.rot === v ? 'selected' : ''}>${tr('rot.' + v)}</option>`).join('')}</select></label>
        </div>
        <div class="type-extra">
          <label title="${tr('type.maxLoad.title')}"><span>${tr('type.maxLoad')}</span><input type="number" min="0" step="any" inputmode="decimal" data-k="maxLoad" value="${t.maxLoad === '' || t.maxLoad == null ? '' : t.maxLoad}" placeholder="${tr('noLimit')}"></label>
          <label class="check small type-nostack" title="${tr('type.noStack.title')}">
            <input type="checkbox" data-k="noStack" ${t.noStack ? 'checked' : ''}> ${tr('type.noStack')}
          </label>
        </div>
        <div class="type-warn" hidden></div>`;
      wrap.appendChild(el);
    });
    validateTypes();
  }

  function validateTypes() {
    const C = config.container;
    for (const el of $$('.type-card')) {
      const t = config.types.find(x => x.id === el.dataset.id);
      if (!t) continue;
      const warn = $('.type-warn', el);
      let msg = '';
      if (!(t.w > 0 && t.h > 0 && t.d > 0)) msg = tr('type.warn.dims');
      else if (C.w > 0 && C.h > 0 && C.d > 0) {
        const fits = Packer.orientationsFor(t).some(o => o[0] <= C.w * (1 + 1e-9) && o[1] <= C.h * (1 + 1e-9) && o[2] <= C.d * (1 + 1e-9));
        if (!fits) msg = tr(t.rot === 'all' ? 'type.warn.noFitAll' : 'type.warn.noFitRot');
      }
      if (!msg && +t.weight > weightCap()) msg = tr('type.warn.heavy', { cap: kg(weightCap()) });
      if (!msg && t.maxLoad !== '' && t.maxLoad != null && !config.types.some(x => x.enabled && +x.weight > 0)) msg = tr('type.warn.loadNoWeight');
      warn.textContent = msg;
      warn.hidden = !msg;
      for (const k of ['w', 'h', 'd']) $(`[data-k="${k}"]`, el).classList.toggle('invalid', !(t[k] > 0));
    }
  }

  function markStale() {
    if (result && !stale) { stale = true; renderResults(); }
    saveSoon();
  }

  function bindForm() {
    $('#unit').addEventListener('change', e => { config.unit = e.target.value; renderContainerInfo(); markStale(); });
    for (const k of ['w', 'h', 'd']) {
      const inp = $('#c-' + k);
      inp.addEventListener('input', () => {
        config.container[k] = parseFloat(inp.value) || 0;
        inp.classList.toggle('invalid', !(config.container[k] > 0));
        renderContainerInfo(); validateTypes(); markStale();
      });
    }
    $('#mode').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      config.mode = b.dataset.v;
      setSegmented($('#mode'), config.mode);
      renderModeHint(); renderTypes(); markStale();
    });
    $('#objective').addEventListener('change', e => { config.objective = e.target.value; markStale(); });
    $('#bins-mode').addEventListener('change', e => { config.bins.auto = e.target.value === 'auto'; renderModeHint(); markStale(); });
    $('#bins-n').addEventListener('input', e => {
      const v = Math.floor(+e.target.value);
      e.target.classList.toggle('invalid', !(v >= 1 && v <= 500));
      if (v >= 1 && v <= 500) { config.bins.n = v; renderModeHint(); markStale(); }
    });
    $('#support').addEventListener('change', e => { config.support = +e.target.value; markStale(); });
    $('#time').addEventListener('change', e => { config.time = +e.target.value; saveSoon(); });
    const onWeight = () => {
      const mw = $('#c-maxw').value, ta = $('#c-tare').value;
      config.maxWeight = mw === '' || !(+mw > 0) ? '' : +mw;
      config.tare = ta === '' || !(+ta > 0) ? '' : +ta;
      renderWeightInfo(); validateTypes(); markStale();
    };
    $('#c-maxw').addEventListener('input', onWeight);
    $('#c-tare').addEventListener('input', onWeight);
    $('#weight-presets').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $('#c-maxw').value = b.dataset.w;
      onWeight();
    });

    $('#btn-add-type').addEventListener('click', () => {
      const used = new Set(config.types.map(t => t.color));
      const color = PALETTE.find(c => !used.has(c)) || PALETTE[config.types.length % PALETTE.length];
      config.types.push({ id: uid(), name: tr('type.defaultName', { n: config.types.length + 1 }), w: 20, h: 20, d: 20, qty: '', rot: 'all', color, enabled: true });
      renderTypes(); markStale();
      const last = $('#types').lastElementChild;
      if (last) { last.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('.type-name', last).select(); }
    });

    const types = $('#types');
    const onField = e => {
      const k = e.target.dataset.k; if (!k) return;
      const card = e.target.closest('.type-card');
      const t = config.types.find(x => x.id === card.dataset.id); if (!t) return;
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (k === 'w' || k === 'h' || k === 'd') t[k] = parseFloat(v) || 0;
      else if (k === 'qty') t.qty = v === '' ? '' : Math.max(0, Math.floor(+v || 0));
      else if (k === 'weight') { t.weight = v === '' || !(+v > 0) ? '' : +v; renderWeightInfo(); }
      else if (k === 'maxLoad') t.maxLoad = v === '' || !(+v >= 0) ? '' : +v;
      else t[k] = v;
      if (k === 'enabled') card.classList.toggle('disabled', !t.enabled);
      if (k === 'color') {
        card.style.setProperty('--type-color', t.color);
        applyColorToResult(t);
        saveSoon();
        return;
      }
      if (k === 'name') { applyNameToResult(t); saveSoon(); return; }
      validateTypes();
      markStale();
    };
    types.addEventListener('input', onField);
    types.addEventListener('change', e => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onField(e); });
    types.addEventListener('click', e => {
      const b = e.target.closest('[data-act="del"]'); if (!b) return;
      const card = b.closest('.type-card');
      config.types = config.types.filter(t => t.id !== card.dataset.id);
      renderTypes(); markStale();
    });
  }

  // El color y el nombre se pueden cambiar sin recalcular.
  function applyColorToResult(t) {
    if (!result) return;
    const st = result.snapshot.types.find(x => x.id === t.id);
    if (!st) return;
    st.color = t.color;
    if (viewer) viewer.setColors(result.snapshot.types.map(x => x.color));
    renderResults(); updateViews(false);
  }
  function applyNameToResult(t) {
    if (!result) return;
    const st = result.snapshot.types.find(x => x.id === t.id);
    if (!st) return;
    st.name = t.name;
    renderResults(); updateViews(false);
  }

  // ---- Cálculo -------------------------------------------------------------

  function validateConfig() {
    const C = config.container;
    if (!(C.w > 0 && C.h > 0 && C.d > 0)) return tr('err.container');
    const active = config.types.filter(t => t.enabled);
    if (!active.length) return tr('err.noTypes');
    if (active.some(t => !(t.w > 0 && t.h > 0 && t.d > 0))) return tr('err.dims');
    if (config.maxWeight > 0 && (+config.tare || 0) >= config.maxWeight) return tr('err.tare');
    if (config.mode === 'fixed' && !active.some(t => +t.qty > 0)) return tr('err.fixedQty');
    return null;
  }

  function showMsg(text, kind) {
    const m = $('#msg');
    if (!text) { m.hidden = true; return; }
    m.textContent = text; m.className = 'msg ' + (kind || 'info'); m.hidden = false;
  }

  // Código que se ejecuta dentro del Web Worker (se serializa con toString()).
  function workerMain() {
    let stopFlag = false;
    self.onmessage = e => {
      const m = e.data;
      if (m.cmd === 'stop') { stopFlag = true; return; }
      if (m.cmd !== 'start') return;
      stopFlag = false;
      const solver = new Packer.MultiSolver(m.input, m.budget, m.maxItems);
      const t0 = Date.now();
      let hurried = false;
      const tick = () => {
        if (stopFlag && !hurried) { solver.hurry(); hurried = true; }
        solver.run(80);
        const el = Date.now() - t0;
        if (solver.done) {
          self.postMessage({ job: m.job, type: 'done', result: solver.result(), stopped: stopFlag });
        } else {
          const pr = solver.progress();
          self.postMessage({ job: m.job, type: 'progress', elapsed: el, count: pr.count, volume: pr.volume, bin: pr.bin, iterations: pr.iterations });
          setTimeout(tick, 0);
        }
      };
      setTimeout(tick, 0);
    };
  }

  let worker = null, workerFailed = typeof Worker === 'undefined';
  function getWorker() {
    if (workerFailed) return null;
    if (worker) return worker;
    try {
      const src = OrganizadorPacker.toString() + '\nconst Packer = OrganizadorPacker();\n(' + workerMain.toString() + ')();';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch (e) {
      workerFailed = true; worker = null;
    }
    return worker;
  }

  let jobSeq = 0;
  function startJob(input, budget, onProgress, onDone) {
    const id = ++jobSeq;
    const job = { id, stop: () => {} };
    const runLocal = () => {
      const solver = new Packer.MultiSolver(input, budget, MAX_ITEMS);
      const t0 = performance.now();
      let stopped = false;
      job.stop = () => { stopped = true; solver.hurry(); };
      const tick = () => {
        if (running !== job) return;
        solver.run(40);
        const el = performance.now() - t0;
        if (solver.done) onDone(solver.result(), stopped);
        else { const pr = solver.progress(); onProgress(Object.assign({ elapsed: el }, pr)); setTimeout(tick, 0); }
      };
      setTimeout(tick, 30);
    };
    const w = getWorker();
    if (!w) { runLocal(); return job; }
    w.onmessage = e => {
      const m = e.data;
      if (m.job !== id || running !== job) return;
      if (m.type === 'progress') onProgress(m); else onDone(m.result, m.stopped);
    };
    w.onerror = e => {
      if (e && e.preventDefault) e.preventDefault();
      workerFailed = true;
      try { w.terminate(); } catch (err) { /* nada */ }
      worker = null;
      if (running === job) runLocal();
    };
    w.postMessage({ cmd: 'start', job: id, input, budget, maxItems: MAX_ITEMS });
    job.stop = () => w.postMessage({ cmd: 'stop', job: id });
    return job;
  }

  function run() {
    if (running) { running.stop(); return; }
    const err = validateConfig();
    if (err) { showMsg(err, 'error'); return; }
    showMsg(null);
    const snapshot = {
      unit: config.unit,
      container: Object.assign({}, config.container),
      mode: config.mode, objective: config.objective, support: config.support,
      maxWeight: config.maxWeight, tare: config.tare,
      bins: config.mode === 'fixed' ? { auto: config.bins.auto, n: config.bins.n } : { auto: false, n: config.bins.n },
      types: config.types.map(t => ({ id: t.id, name: t.name, color: t.color, w: t.w, h: t.h, d: t.d, qty: t.qty, rot: t.rot, enabled: t.enabled, noStack: !!t.noStack, weight: +t.weight || 0, maxLoad: t.maxLoad === '' || t.maxLoad == null ? '' : +t.maxLoad }))
    };
    const input = {
      container: snapshot.container, mode: config.mode, objective: config.objective, support: config.support,
      maxWeight: +config.maxWeight || 0, tare: +config.tare || 0,
      bins: snapshot.bins,
      types: snapshot.types.map(t => ({ w: t.w, h: t.h, d: t.d, rot: t.rot, enabled: t.enabled, noStack: t.noStack, weight: t.weight, maxLoad: t.maxLoad, qty: t.qty === '' ? null : +t.qty }))
    };
    const budget = config.time * 1000;
    const btn = $('#btn-run');
    btn.textContent = tr('run.stop');
    btn.classList.add('running');
    $('#progress').hidden = false;
    $('#progress-bar').style.width = '0%';
    $('#progress-text').textContent = tr('run.preparing');
    const V = snapshot.container.w * snapshot.container.h * snapshot.container.d;

    running = startJob(input, budget, p => {
      $('#progress-bar').style.width = Math.min(100, p.elapsed / budget * 100) + '%';
      const multi = snapshot.bins.auto || snapshot.bins.n > 1;
      $('#progress-text').textContent = multi
        ? tr('run.progressMulti', { s: fmt(p.elapsed / 1000, 1), bin: p.bin || 1, n: fmt(p.count, 0) })
        : tr('run.progress', { s: fmt(p.elapsed / 1000, 1), n: fmt(p.count, 0), p: pct(p.volume / V) });
    }, (res, stopped) => {
      running = null;
      btn.textContent = tr('run.go');
      btn.classList.remove('running');
      $('#progress').hidden = true;
      res.snapshot = snapshot;
      res.stopped = stopped;
      res.date = new Date().toISOString();
      result = res;
      stale = false;
      layerCache = {};
      ui.layer = 0;
      ui.bin = 0;
      onNewResult();
      save();
    });
  }

  // ---- Resultados ------------------------------------------------------------

  // Texto del centro de gravedad de un resultado.
  function cogText(res, S, u) {
    const c = res.cog;
    if (!c) return '';
    const off = res.cogOffset || 0;
    return tr('cog.line', { y: fmt(c.y), u, p: pct(c.y / S.container.h) }) +
      (off < Math.max(S.container.w, S.container.d) * 0.01 ? tr('cog.centered') : tr('cog.off', { off: fmt(off), u }));
  }

  function weightLines(res, S, u) {
    const tare = res.tare || 0;
    if (!(res.weight > 0) && res.maxWeight == null) return '';
    let t = tr('w.line', { w: kg(res.weight) });
    if (tare > 0) t += tr('w.lineTare', { t: kg(tare), tot: kg(res.weight + tare) });
    if (res.maxWeight != null) t += tr('w.lineMax', { p: pct((res.weight + tare) / res.maxWeight), max: kg(res.maxWeight) });
    const c = cogText(res, S, u);
    return `<p class="hint">${t}${c ? `<br>${c}` : ''}</p>`;
  }

  // Contenedor k (resolviendo los idénticos) y agrupación de contenedores iguales.
  function srcIndex(k) { const b = result && result.bins[k]; return b && b.sameAs != null ? b.sameAs : k; }
  function binAt(k) { return result ? result.bins[srcIndex(k == null ? ui.bin : k)] : null; }
  function binGroups() {
    const groups = [];
    (result ? result.bins : []).forEach((b, k) => {
      const src = srcIndex(k), g = groups[groups.length - 1];
      if (g && g.src === src) g.to = k; else groups.push({ from: k, to: k, src });
    });
    return groups;
  }
  const isMulti = () => !!result && (result.nBins > 1 || result.auto || (result.target || 1) > 1);
  const binLabel = g => (g.from === g.to ? `${g.from + 1}` : `${g.from + 1}–${g.to + 1}`);

  function renderResults() {
    const box = $('#results');
    $('#stale').hidden = !(result && stale);
    if (!result) {
      box.innerHTML = `<p class="empty">${tr('res.empty')}</p>`;
      return;
    }
    const R = result, S = R.snapshot, u = unitName(S.unit), fixed = S.mode === 'fixed';
    const V = R.containerVolume, multi = isMulti(), n = R.nBins;
    const B = binAt(ui.bin) || { items: [], count: 0, volume: 0, utilization: 0, top: 0, placed: S.types.map(() => 0), weight: 0 };
    const hasW = S.types.some(t => t.enabled && t.weight > 0);
    const maxW = R.maxWeight, tare = R.tare || 0;
    const capW = maxW != null ? Math.max(0, maxW - tare) : Infinity;
    const segs = S.types.map((t, i) => {
      const v = B.placed[i] * t.w * t.h * t.d;
      return v > 0 ? `<i style="width:${v / V * 100}%;background:${t.color}" title="${esc(t.name)}"></i>` : '';
    }).join('');
    const rows = S.types.map((t, i) => {
      if (!t.enabled) return '';
      const req = R.requested[i];
      const reqTxt = req == null || req === Infinity || req === null ? '—' : fmt(req, 0);
      return `<tr>
        <td><span class="dot" style="background:${t.color}"></span>${esc(t.name)}${t.noStack ? ` <span class="tag" title="${tr('tag.noStack.title')}">${tr('tag.noStack')}</span>` : ''}${t.maxLoad !== '' && t.maxLoad != null && t.weight !== undefined ? ` <span class="tag load" title="${tr('tag.maxLoad.title')}">${tr('tag.maxLoad', { w: kg(+t.maxLoad) })}</span>` : ''}</td>
        <td class="num">${fmt(t.w)}×${fmt(t.h)}×${fmt(t.d)}</td>
        <td class="num"><b>${fmt(R.placed[i], 0)}</b></td>
        <td class="num">${reqTxt}</td>
        ${hasW ? `<td class="num">${t.weight > 0 ? fmt(R.placed[i] * t.weight, 1) : '—'}</td>` : ''}
      </tr>`;
    }).join('');

    // Tabla de contenedores (agrupando los idénticos)
    const groups = binGroups();
    const binRows = multi ? groups.map(g => {
      const b = R.bins[g.src], k = g.to - g.from + 1, sel = ui.bin >= g.from && ui.bin <= g.to;
      return `<tr class="bin-row${sel ? ' selected' : ''}" data-bin="${g.from}" tabindex="0" title="${tr('bin.row.title')}">
        <td>${binLabel(g)}${k > 1 ? ` <span class="tag same">${tr('tag.same', { k })}</span>` : ''}</td>
        <td class="num"><b>${fmt(b.count, 0)}</b>${k > 1 ? ' ' + tr('each') : ''}</td>
        <td class="num">${pct(b.utilization)}</td>
        ${hasW ? `<td class="num">${fmt(b.weight + tare, 1)} kg</td>` : ''}
      </tr>`;
    }).join('') : '';

    const notes = [];
    const left = R.leftover || [];
    S.types.forEach((t, i) => {
      if (!t.enabled) return;
      if (!R.fits[i]) notes.push(['warn', tr('note.noFit', { name: esc(t.name) })]);
      else if (R.tooHeavy && R.tooHeavy[i]) notes.push(['warn', tr('note.tooHeavy', { name: esc(t.name), w: kg(t.weight), cap: kg(capW) })]);
      if (fixed && left[i] > 0 && R.fits[i] && !(R.tooHeavy && R.tooHeavy[i])) {
        let why = '';
        if (!multi) why = tr(isFinite(capW) && t.weight > 0 && capW - B.weight < t.weight - 1e-9 ? 'note.whyWeight' : 'note.whySpace');
        const where = multi ? (n === 1 ? tr('note.whereOne') : tr('note.whereN', { n })) : '';
        notes.push(['warn', tr('note.unplaced', { n: fmt(left[i], 0), name: esc(t.name), where, why })]);
      }
    });
    const bound = tr(isFinite(capW) ? 'bound.volW' : 'bound.vol');
    if (fixed && R.auto) {
      if (R.complete) {
        notes.push(['ok', tr('note.needBins', { n: fmt(n, 0), c: n, total: fmt(R.count, 0) })]);
        if (n <= R.lowerBound) notes.push(['ok', tr('note.isMin')]);
        else notes.push(['info', tr('note.lowerBound', { bound, lb: R.lowerBound, n })]);
      } else notes.push(['warn', tr('note.notAll')]);
    } else if (fixed && R.complete) {
      notes.push(['ok', n > 1 ? tr('note.allInN', { n }) : tr('note.allFit')]);
    } else if (fixed && multi && !R.complete) {
      notes.push(['info', tr('note.tryAuto')]);
    }
    if (!fixed && multi) {
      const same = groups.length === 1;
      notes.push(['info', tr('note.inN', { n, c: n, total: fmt(R.count, 0), each: same && n > 1 ? fmt(R.bins[0].count, 0) : '' })]);
      if (R.target && n < R.target) notes.push(['info', tr('note.onlyUsed', { n, target: R.target })]);
    }
    if (!fixed && !multi && isFinite(capW)) {
      const lightest = Math.min(...S.types.filter((t, i) => t.enabled && t.weight > 0 && R.fits[i]).map(t => t.weight));
      if (isFinite(lightest) && capW - B.weight < lightest - 1e-9) {
        notes.push(['info', tr('note.weightBinds', { left: kg(capW - B.weight) })]);
      }
    }
    if (!fixed && !multi && B.boundReached) notes.push(['ok', tr('note.optimal')]);
    if (!fixed && !multi && !B.boundReached && S.objective === 'count' && isFinite(B.countBound)) {
      notes.push(['info', tr('note.maxBound', { bound, n: fmt(B.countBound, 0) })]);
    }
    if (B.grouped) notes.push(['info', tr('note.grouped', { n: fmt(B.items.length, 0) })]);
    if (R.stopped) notes.push(['info', tr('note.stopped')]);

    const view = Object.assign({ tare, maxWeight: maxW }, B);
    const showW = hasW || maxW != null;
    const kpis = multi
      ? `<div class="kpis three">
          <div class="kpi"><b>${fmt(n, 0)}</b><span>${tr('kpi.bins', { n })}</span></div>
          <div class="kpi"><b>${fmt(R.count, 0)}</b><span>${tr('kpi.total')}</span></div>
          <div class="kpi"><b>${pct(R.utilization)}</b><span>${tr('kpi.avg')}</span></div>
        </div>`
      : `<div class="kpis${showW ? ' three' : ''}">
          <div class="kpi"><b>${fmt(B.count, 0)}</b><span>${tr('kpi.placed')}</span></div>
          <div class="kpi"><b>${pct(B.utilization)}</b><span>${tr('kpi.vol')}</span></div>
          ${showW ? `<div class="kpi${maxW != null && B.weight + tare > maxW * 0.95 ? ' full' : ''}"><b>${fmt(B.weight + tare, 1)} kg</b><span>${maxW != null ? tr('kpi.maxOf', { w: fmt(maxW, 1) }) : tr('kpi.totalW')}</span></div>` : ''}
        </div>`;

    const dims = `${fmt(S.container.w)}×${fmt(S.container.h)}×${fmt(S.container.d)} ${u}`;
    box.innerHTML = `
      ${kpis}
      <table class="type-table">
        <thead><tr><th>${tr('th.type')}</th><th class="num">${tr('th.dims')}</th><th class="num">${tr(multi ? 'th.total' : 'th.placed')}</th><th class="num">${tr(fixed ? 'th.req' : 'th.max')}</th>${hasW ? '<th class="num">kg</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${notes.length ? `<ul class="notes">${notes.map(([k, t]) => `<li class="${k}">${t}</li>`).join('')}</ul>` : ''}
      ${multi ? `<h3 class="sub">${tr('res.binsTitle')}</h3>
      <table class="type-table bin-table">
        <thead><tr><th>${tr('th.no')}</th><th class="num">${tr('th.boxes')}</th><th class="num">${tr('th.fill')}</th>${hasW ? `<th class="num">${tr('th.weight')}</th>` : ''}</tr></thead>
        <tbody>${binRows}</tbody>
      </table>
      <h3 class="sub">${n > 1 ? tr('res.binTitleOf', { k: ui.bin + 1, n }) : tr('res.binTitle', { k: ui.bin + 1 })}</h3>` : ''}
      <div class="util" aria-hidden="true">${segs}</div>
      <p class="hint">${multi ? tr('res.boxesDot', { n: fmt(B.count, 0) }) : ''}${tr('res.volLine', { v: volText(B.volume, S.unit), V: volText(V, S.unit), p: pct(B.utilization), top: fmt(B.top), H: fmt(S.container.h), u })}</p>
      ${weightLines(view, S, u)}
      <p class="meta">${tr('res.meta', { it: fmt(R.iterations, 0), c: R.iterations, s: fmt((R.elapsed || 0) / 1000, 1), dims })}</p>`;
  }

  // ---- Capas -----------------------------------------------------------------

  function getLayers(axis, bin) {
    const B = binAt(bin);
    if (!B) return [];
    const key = srcIndex(bin == null ? ui.bin : bin) + ':' + axis;
    if (layerCache[key]) return layerCache[key];
    const [k, ks] = AXIS_KEYS[axis];
    const size = result.snapshot.container[ks];
    const eps = size * 1e-7;
    const starts = B.items.map(it => it[k]).sort((a, b) => a - b);
    const uniq = [];
    for (const s of starts) if (!uniq.length || s - uniq[uniq.length - 1] > eps) uniq.push(s);
    let end = 0;
    for (const it of B.items) end = Math.max(end, it[k] + it[ks]);
    const layers = uniq.map((lo, i) => ({ lo, hi: i + 1 < uniq.length ? uniq[i + 1] : end }));
    layerCache[key] = layers;
    return layers;
  }

  // Capa idx del eje dado. opts: { ghost, solidBefore } para los estados 3D.
  function layerAt(axis, idx, opts, bin) {
    if (bin == null) bin = ui.bin;
    const layers = getLayers(axis, bin);
    if (!layers.length) return null;
    idx = Math.max(0, Math.min(layers.length - 1, idx | 0));
    const L = layers[idx];
    const [k, ks] = AXIS_KEYS[axis];
    const eps = result.snapshot.container[ks] * 1e-7;
    const p = L.lo + eps;
    const items = binAt(bin).items, n = items.length;
    const visible = [], states = new Uint8Array(n);
    const ghostState = opts.ghost > 0.001 ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const it = items[i], s = it[k], e = s + it[ks];
      if (s <= p && e > p) {
        const cont = s < L.lo - eps;
        visible.push({ i, cont });
        states[i] = cont ? 2 : 1;
      } else if (opts.solidBefore && e <= p) states[i] = 4;
      else states[i] = ghostState;
    }
    return { layers, index: idx, L, visible, states, bin };
  }

  function currentLayer() {
    const info = layerAt(ui.axis, ui.layer, ui);
    if (info) ui.layer = info.index;
    return info;
  }

  // Resumen de una capa: cajas nuevas por tipo y cajas que continúan.
  function layerCounts(info) {
    const byType = new Map();
    let nNew = 0, nCont = 0, wNew = 0;
    for (const v of info.visible) {
      const it = binAt(info.bin).items[v.i], c = it.count || 1;
      if (v.cont) { nCont += c; continue; }
      nNew += c;
      wNew += c * (result.snapshot.types[it.t].weight || 0);
      byType.set(it.t, (byType.get(it.t) || 0) + c);
    }
    return { byType, nNew, nCont, wNew };
  }

  // ---- Vistas ----------------------------------------------------------------

  let viewer = null, layerView = null;

  function describe(i) {
    if (!result) return '';
    const it = binAt().items[i], S = result.snapshot, t = S.types[it.t], u = unitName(S.unit);
    let orient = '';
    if (it.count > 1) orient = `<div>${tr('tip.block', { n: fmt(it.count, 0) })}</div>`;
    else if (Math.abs(it.h - t.h) > 1e-9) orient = `<div>${tr('tip.lying')}</div>`;
    else if (Math.abs(it.w - t.w) > 1e-9) orient = `<div>${tr('tip.turned')}</div>`;
    return `<b><i style="background:${t.color}"></i>${esc(t.name)}</b>
      <div>${fmt(it.w)} × ${fmt(it.h)} × ${fmt(it.d)} ${u} <span style="opacity:.7">(${tr('dims.short')})</span></div>
      <div>${tr('tip.pos')}: X ${fmt(it.x)} · Y ${fmt(it.y)} · Z ${fmt(it.z)}</div>${orient}` +
      (t.weight > 0 ? `<div>${tr('tip.weight', { w: kg(t.weight * (it.count || 1)) })}</div>` : '') +
      (it.load !== undefined && it.load !== null ? `<div>${tr('tip.load', { l: kg(it.load) })}${t.maxLoad !== '' && t.maxLoad != null ? tr('tip.loadOf', { m: kg(+t.maxLoad) }) : ''}</div>` : '') +
      (t.noStack ? `<div>${tr('tag.noStack.title')}</div>` : '');
  }

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function applyTheme() {
    const rgb = h => OrgColor.hexToRgb(h);
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    if (viewer && !viewer.failed) {
      viewer.setTheme({
        bg: rgb(cssVar('--view-bg')),
        grid: dark ? [1, 1, 1, 0.07] : [0, 0, 0, 0.08],
        frame: rgb(cssVar('--view-frame')).concat(0.85),
        edge: dark ? [0, 0, 0, 0.6] : [0, 0, 0, 0.4],
        accent: rgb(cssVar('--accent'))
      });
    }
    if (layerView) {
      layerView.setTheme({
        bg: cssVar('--view-bg'), empty: cssVar('--view-empty'),
        grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
        frame: cssVar('--view-frame'), text: cssVar('--view-text'),
        edge: dark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.5)'
      });
    }
  }

  function sceneFor(bin) {
    const S = result.snapshot;
    return {
      container: S.container, items: binAt(bin).items,
      colors: S.types.map(t => t.color), unit: unitName(S.unit), fmt: v => fmt(v)
    };
  }

  function onNewResult() {
    renderResults();
    if (viewer && !viewer.failed) {
      if (result) { viewer.setScene(sceneFor()); viewer.setMarker(binAt().cog || null); }
      else { viewer.setScene({ container: config.container, items: [], colors: [], unit: unitName(config.unit), fmt: v => fmt(v) }); viewer.setMarker(null); }
    }
    renderBinBar();
    updateViews(true);
  }

  // Selector de contenedor (solo si hay más de uno).
  function renderBinBar() {
    const bar = $('#binbar');
    const n = result ? result.nBins : 0;
    bar.hidden = !(result && n > 1);
    if (bar.hidden) return;
    const sel = $('#bin-select');
    sel.innerHTML = result.bins.map((b, k) => {
      const src = srcIndex(k), B = result.bins[src];
      return `<option value="${k}">${tr('bin.option', { k: k + 1, n, c: fmt(B.count, 0) })}${src !== k ? tr('bin.sameAs', { k: src + 1 }) : ''}</option>`;
    }).join('');
    sel.value = String(ui.bin);
    $('#bin-prev').disabled = ui.bin <= 0;
    $('#bin-next').disabled = ui.bin >= n - 1;
    const B = binAt();
    const hasW = result.snapshot.types.some(t => t.enabled && t.weight > 0);
    $('#bin-info').textContent = tr('bin.info', { p: pct(B.utilization) }) + (hasW ? ` · ${kg(B.weight + (result.tare || 0))}` : '');
  }

  function setBin(k) {
    if (!result) return;
    k = Math.max(0, Math.min(result.nBins - 1, k | 0));
    if (k === ui.bin) return;
    const sameLayout = srcIndex(k) === srcIndex(ui.bin);
    ui.bin = k;
    if (!sameLayout && viewer && !viewer.failed) { viewer.setScene(sceneFor(), true); viewer.setMarker(binAt().cog || null); }
    renderBinBar();
    renderResults();
    updateViews(true);
    saveSoon();
  }

  function updateViews(rebuild3d) {
    const info = currentLayer();
    const layers = info ? info.layers : [];
    const slider = $('#layer-slider');
    slider.max = Math.max(0, layers.length - 1);
    slider.value = ui.layer;
    slider.disabled = !layers.length;
    $('#layer-prev').disabled = !layers.length || ui.layer <= 0;
    $('#layer-next').disabled = !layers.length || ui.layer >= layers.length - 1;

    const S = result ? result.snapshot : null;
    const u = unitName(S ? S.unit : config.unit);
    const AX = ui.axis.toUpperCase();
    if (info) {
      const L = info.L;
      $('#layer-label').textContent = tr('layer.label', { i: ui.layer + 1, n: layers.length, ax: AX, lo: fmt(L.lo), hi: fmt(L.hi), u });
    } else $('#layer-label').textContent = result ? tr('layer.noBoxes') : '—';

    // 3D
    if (viewer && !viewer.failed && result && rebuild3d !== false) {
      if (ui.layerMode && info) viewer.setStates(info.states, ui.ghost, { axis: ui.axis, pos: info.L.lo });
      else viewer.setStates(null, ui.ghost, null);
    }
    $('#ghost-tools').style.visibility = ui.layerMode && result ? 'visible' : 'hidden';

    // 2D
    const container = S ? S.container : config.container;
    const A = AXIS_TEXT[ui.axis];
    const binTxt = result && result.nBins > 1 ? tr('v2d.bin', { k: ui.bin + 1 }) : '';
    $('#v2d-title').textContent = binTxt + (info
      ? tr('v2d.cut', { view: A.view, ax: AX, lo: fmt(info.L.lo), u, dir: A.dir })
      : A.view);
    if (layerView) {
      layerView.set({
        container, axis: ui.axis, unit: u, fmt: v => fmt(v),
        items: result ? binAt().items : [],
        colors: S ? S.types.map(t => t.color) : [],
        names: S ? S.types.map(t => t.name) : [],
        visible: info ? info.visible : [],
        emptyText: result ? tr('layer.noBoxes') : tr('v2d.pressRun')
      });
    }
    renderLayerSummary(info);
  }

  function renderLayerSummary(info) {
    const el = $('#layer-summary');
    if (!info) { el.innerHTML = `<span>${tr('sum.hint')}</span>`; return; }
    const S = result.snapshot, u = unitName(S.unit);
    const { byType, nNew, nCont, wNew } = layerCounts(info);
    const chips = [...byType.entries()].map(([t, n]) =>
      `<span class="chip"><span class="dot" style="background:${S.types[t].color}"></span><b>${fmt(n, 0)}×</b> ${esc(S.types[t].name)}</span>`).join('');
    const thick = info.L.hi - info.L.lo;
    el.innerHTML = `<span class="chip">${tr('sum.new', { n: fmt(nNew, 0) })}</span>${chips}` +
      (nCont ? `<span class="chip"><span class="hatch"></span>${tr('sum.cont', { n: fmt(nCont, 0) })}</span>` : '') +
      (wNew > 0 ? `<span class="chip">${tr('sum.weight', { w: kg(wNew) })}</span>` : '') +
      `<span class="chip">${tr('sum.thick', { t: `${fmt(thick)} ${u}` })}</span>`;
  }

  function setLayer(i, fromUser) {
    ui.layer = i;
    if (fromUser && !ui.layerMode) { ui.layerMode = true; $('#layer-mode').checked = true; }
    updateViews(true);
    saveSoon();
  }

  function bindViews() {
    const c3d = $('#c3d');
    try {
      viewer = new Viewer3D(c3d, { tooltip: $('#tip3d'), labels: $('#v3d-labels'), describe });
    } catch (e) {
      viewer = { failed: true };
      console.error(e);
    }
    if (viewer.failed) { $('#nogl').hidden = false; c3d.style.display = 'none'; }
    layerView = new LayerView($('#c2d'), { tooltip: $('#tip2d'), describe });

    setSegmented($('#view-mode'), ui.view);
    $('#views').dataset.mode = ui.view;
    setSegmented($('#axis'), ui.axis);
    $('#layer-mode').checked = ui.layerMode;
    $('#ghost').value = ui.ghost;
    $('#solid-before').checked = ui.solidBefore;

    $('#view-mode').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      ui.view = b.dataset.v;
      setSegmented($('#view-mode'), ui.view);
      $('#views').dataset.mode = ui.view;
      if (viewer && !viewer.failed) requestAnimationFrame(() => viewer.resetView());
      saveSoon();
    });
    $('#axis').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      ui.axis = b.dataset.v; ui.layer = 0;
      setSegmented($('#axis'), ui.axis);
      updateViews(true); saveSoon();
    });
    $('#layer-mode').addEventListener('change', e => { ui.layerMode = e.target.checked; updateViews(true); saveSoon(); });
    $('#bin-select').addEventListener('change', e => setBin(+e.target.value));
    $('#bin-prev').addEventListener('click', () => setBin(ui.bin - 1));
    $('#bin-next').addEventListener('click', () => setBin(ui.bin + 1));
    const pickBin = e => { const tr2 = e.target.closest('.bin-row'); if (tr2) setBin(+tr2.dataset.bin); };
    $('#results').addEventListener('click', pickBin);
    $('#results').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickBin(e); } });
    $('#layer-slider').addEventListener('input', e => setLayer(+e.target.value, true));
    $('#layer-prev').addEventListener('click', () => setLayer(ui.layer - 1, true));
    $('#layer-next').addEventListener('click', () => setLayer(ui.layer + 1, true));
    $('#ghost').addEventListener('input', e => { ui.ghost = +e.target.value; updateViews(true); saveSoon(); });
    $('#solid-before').addEventListener('change', e => { ui.solidBefore = e.target.checked; updateViews(true); saveSoon(); });
    $('#cam-views').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !viewer || viewer.failed) return;
      viewer.setView(b.dataset.v);
    });

    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' && e.target.type !== 'range' || tag === 'select' || tag === 'textarea') return;
      if (e.target.type === 'range' && e.target.id === 'layer-slider') return;
      const layers = getLayers(ui.axis);
      if (!layers.length) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (ui.layer < layers.length - 1) setLayer(ui.layer + 1, true);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (ui.layer > 0) setLayer(ui.layer - 1, true);
        e.preventDefault();
      } else if (e.key === 'Home') { setLayer(0, true); e.preventDefault(); }
      else if (e.key === 'End') { setLayer(layers.length - 1, true); e.preventDefault(); }
    });

    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    applyTheme();
  }

  // ---- Idioma --------------------------------------------------------------------

  // Traduce los nombres que siguen siendo los predeterminados ("Caja grande", "Caja 3"…);
  // los que ha escrito el usuario no se tocan.
  function translateDefaultName(name) {
    const D = I18n._dict;
    for (const key of ['ex.big', 'ex.medium', 'ex.small']) if (D[key].includes(name)) return tr(key);
    for (const pattern of D['type.defaultName']) {
      const m = name.match(new RegExp('^' + pattern.replace('{n}', '(\\d+)') + '$'));
      if (m) return tr('type.defaultName', { n: m[1] });
    }
    return name;
  }

  function setLanguage(code) {
    I18n.setLang(code);
    ui.lang = I18n.lang;
    $('#lang').value = I18n.lang;
    for (const t of config.types) t.name = translateDefaultName(t.name);
    if (result) for (const t of result.snapshot.types) t.name = translateDefaultName(t.name);
    // Si la URL trae ?lang=, se actualiza para que al recargar se mantenga el idioma elegido.
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('lang')) { url.searchParams.set('lang', I18n.lang); history.replaceState(null, '', url); }
    } catch (e) { /* file:// sin historial */ }
    renderForm();
    renderResults();
    renderBinBar();
    updateViews(false);
    if (viewer && !viewer.failed) viewer.requestRender();
    saveSoon();
  }

  function bindLanguage() {
    $('#lang').addEventListener('change', e => setLanguage(e.target.value));
  }

  // ---- Proyecto: guardar / abrir ----------------------------------------------

  function bindProject() {
    $('#btn-export').addEventListener('click', () => {
      const data = { app: 'organizador-espacios', version: 1, savedAt: new Date().toISOString(), config, result };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      a.download = `organizador-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('#btn-import').addEventListener('click', () => $('#file-import').click());
    $('#file-import').addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || !data.config) throw new Error('formato');
        if (running) { running.stop(); }
        config = sanitizeConfig(data.config);
        result = data.result && data.result.snapshot && (Array.isArray(data.result.items) || Array.isArray(data.result.bins)) ? normalizeResult(data.result) : null;
        stale = false; layerCache = {}; ui.layer = 0; ui.bin = 0;
        renderForm(); onNewResult(); save();
        showMsg(tr('proj.loaded', { f: f.name }), 'info');
      } catch (err) {
        showMsg(tr('proj.invalid'), 'error');
      }
    });
    $('#btn-example').addEventListener('click', () => {
      if (!confirm(tr('proj.confirmExample'))) return;
      config = example(); result = null; stale = false; layerCache = {}; ui.layer = 0; ui.bin = 0;
      renderForm(); onNewResult(); save(); showMsg(null);
    });
  }

  // ---- Inicio ------------------------------------------------------------------

  load();
  I18n.setLang(I18n.detect(ui.lang));
  ui.lang = I18n.lang;
  $('#lang').value = I18n.lang;
  loadConfig();
  if (!result || !(ui.bin < result.nBins)) ui.bin = 0;
  renderForm();
  bindForm();
  bindViews();
  bindLanguage();
  bindProject();
  $('#btn-run').addEventListener('click', run);
  $('#btn-export-layers').addEventListener('click', () => {
    if (!result) { showMsg(tr('export.needResult'), 'error'); return; }
    Exporter.open({
      result, ui, viewer: viewer && !viewer.failed ? viewer : null,
      getLayers, layerAt, layerCounts, fmt, unitName, volText, pct, stale, cogText, kg,
      axisText: AXIS_TEXT, binAt, binGroups, isMulti,
      // Muestra temporalmente otro contenedor en el visor 3D (para las imágenes).
      showBin: k => { if (viewer && !viewer.failed) { viewer.setScene(sceneFor(k), true); viewer.setMarker(binAt(k).cog || null); } }
    });
  });
  onNewResult();
  // Acceso para depuración desde la consola del navegador.
  window.organizador = { get config() { return config; }, get result() { return result; }, get viewer() { return viewer; }, get layerView() { return layerView; }, ui, setLanguage };
  if (!result) run();
})();
