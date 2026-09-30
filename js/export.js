/*
 * Organizador de espacios — exportación de capas a PDF y PNG.
 *
 * Cada página de capa se compone con un "pintor" (PdfPainter o CanvasPainter),
 * de modo que el PDF y el PNG tienen exactamente el mismo diseño.
 */
(function (root) {
  'use strict';

  const $ = s => document.querySelector(s);
  const LIGHT_2D = { bg: '#ffffff', empty: '#f1f4f8', grid: 'rgba(0,0,0,0.08)', frame: '#3a4452', text: '#4a5563', edge: 'rgba(0,0,0,0.5)' };
  const LIGHT_3D = { bg: [1, 1, 1], grid: [0, 0, 0, 0.08], frame: [0.23, 0.27, 0.32, 0.85], edge: [0, 0, 0, 0.4], accent: [0.15, 0.39, 0.92] };
  const INK = '#1b2330', MUTED = '#5b6676', FAINT = '#8a94a3', RULE = '#dfe3e8', ACCENT = '#2563eb';
  const PAPER = { a4: [841.89, 595.28], letter: [792, 612] };
  const tr = (k, p) => I18n.t(k, p);
  const M = 32;

  let ctx = null, busy = false;
  const tick = () => new Promise(r => setTimeout(r, 0));

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function stamp() {
    const d = new Date(), z = v => String(v).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  }

  function fitText(p, str, size, bold, maxW) {
    if (p.measure(str, size, bold) <= maxW) return str;
    let s = str;
    while (s.length > 1 && p.measure(s + '…', size, bold) > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  // ---- Piezas comunes ---------------------------------------------------------

  function layerData(info, axis) {
    const S = ctx.result.snapshot;
    return {
      container: S.container, axis, unit: ctx.unitName(S.unit), fmt: v => ctx.fmt(v),
      items: ctx.binAt(info.bin).items, colors: S.types.map(t => t.color), names: S.types.map(t => t.name),
      visible: info.visible
    };
  }

  function render3D(o, info, pxW, pxH, type) {
    if (!ctx.viewer || !o.with3d) return null;
    let states = null, plane = null;
    if (info) {
      states = ctx.layerAt(o.axis, info.index, { ghost: 0.07, solidBefore: o.before }, info.bin).states;
      plane = { axis: o.axis, pos: info.L.lo };
    }
    return ctx.viewer.renderImage({
      width: pxW, height: pxH, states, plane, ghostOpacity: 0.07, view: 'iso',
      theme: LIGHT_3D, type: type || 'image/jpeg', quality: 0.9
    });
  }

  // Dibuja una imagen 3D con marco y etiquetas de medidas.
  async function place3D(p, putImage, img, pxW, pxH, x, y, w, h) {
    await putImage(img.url, pxW, pxH, x, y, w, h);
    p.strokeRect(x, y, w, h, RULE, 0.8);
    const k = w / pxW;
    for (const l of img.labels) {
      const lx = x + l.x * k, ly = y + l.y * k;
      if (lx < x + 10 || lx > x + w - 10 || ly < y + 6 || ly > y + h - 6) continue;
      const cg = l.text === 'CG', tw = p.measure(l.text, 7.5, cg);
      p.fillRect(lx - tw / 2 - 3, ly - 5.5, tw + 6, 11, cg ? '#db2777' : '#ffffff', cg ? 1 : 0.85);
      p.text(l.text, lx, ly, { size: 7.5, bold: cg, color: cg ? '#ffffff' : MUTED, align: 'center', baseline: 'middle' });
    }
  }

  function footer(p, W, H, pageNo, total) {
    const S = ctx.result.snapshot, u = ctx.unitName(S.unit), f = ctx.fmt;
    p.lines([[M, H - 26, W - M, H - 26]], RULE, 0.6);
    p.text(tr('pdf.footer', { app: tr('app.title'), dims: `${f(S.container.w)} × ${f(S.container.h)} × ${f(S.container.d)} ${u}` }),
      M, H - 14, { size: 8, color: FAINT, baseline: 'middle' });
    if (pageNo) p.text(tr('pdf.page', { p: pageNo, n: total }), W - M, H - 14, { size: 8, color: FAINT, align: 'right', baseline: 'middle' });
  }

  // ---- Página de una capa -------------------------------------------------------

  // g: grupo de contenedores idénticos { from, to, src } (null si solo hay uno)
  async function drawLayerPage(p, putImage, W, H, o, index, pageNo, total, g) {
    const S = ctx.result.snapshot, u = ctx.unitName(S.unit), f = ctx.fmt;
    const bin = g ? g.src : ctx.ui.bin;
    const info = ctx.layerAt(o.axis, index, { ghost: 0, solidBefore: false }, bin);
    const n = info.layers.length, L = info.L, AX = o.axis.toUpperCase();
    p.fillRect(0, 0, W, H, '#ffffff');

    // Cabecera
    const multi = ctx.isMulti();
    const binTxt = !multi ? '' : !g ? tr('pdf.binPrefix', { k: bin + 1 }) : g.from === g.to ? tr('pdf.binPrefix', { k: g.from + 1 }) : tr('pdf.binsPrefix', { a: g.from + 1, b: g.to + 1 });
    p.text(tr('pdf.layerTitle', { bin: binTxt, i: index + 1, n }), M, M, { size: 18, bold: true, color: INK, baseline: 'top' });
    if (g && g.to > g.from) {
      p.text(tr('pdf.sameNote', { k: g.to - g.from + 1 }), W - M, M + 16, { size: 8.5, color: MUTED, align: 'right', baseline: 'top' });
    }
    p.text(ctx.axisText[o.axis].name, W - M, M + 2, { size: 10, bold: true, color: ACCENT, align: 'right', baseline: 'top' });
    p.text(tr('pdf.cutLine', { view: ctx.axisText[o.axis].view, ax: AX, lo: f(L.lo), u, th: f(L.hi - L.lo) }),
      M, M + 25, { size: 9.5, color: MUTED, baseline: 'top' });
    p.lines([[M, M + 42, W - M, M + 42]], RULE, 0.8);

    const top = M + 52, bottom = H - 36;
    const colW = o.with3d && ctx.viewer ? Math.min(300, (W - 2 * M) * 0.4) : 200;
    const diagW = W - 2 * M - colW - 16;
    LayerView.drawDiagram(p, { x: M, y: top, w: diagW, h: bottom - top }, layerData(info, o.axis), LIGHT_2D, { scale: 0.8, arrows: false });

    // Columna derecha: vista 3D + leyenda
    const cx = M + diagW + 16;
    let y = top;
    if (o.with3d && ctx.viewer) {
      const ih = Math.round(colW * 0.78);
      const pxW = Math.round(colW * 2.2), pxH = Math.round(ih * 2.2);
      const img = render3D(o, info, pxW, pxH);
      if (img) { await place3D(p, putImage, img, pxW, pxH, cx, y, colW, ih); y += ih + 18; }
    }
    const { byType, nNew, nCont, wNew } = ctx.layerCounts(info);
    p.text(tr('pdf.inLayer'), cx, y, { size: 11, bold: true, color: INK, baseline: 'top' });
    y += 20;
    p.text(tr('pdf.newBoxes', { n: f(nNew, 0), c: nNew }), cx, y, { size: 9.5, color: MUTED, baseline: 'top' });
    y += 18;
    for (const [t, c] of byType) {
      if (y > bottom - 40) { p.text('…', cx, y, { size: 10, color: MUTED, baseline: 'top' }); y += 16; break; }
      const T = S.types[t];
      p.fillRect(cx, y + 1, 10, 10, T.color);
      p.text(fitText(p, `${f(c, 0)} × ${T.name}`, 10, true, colW - 16), cx + 16, y, { size: 10, bold: true, color: INK, baseline: 'top' });
      p.text(`${f(T.w)} × ${f(T.h)} × ${f(T.d)} ${u}${T.weight > 0 ? tr('pdf.perBox', { w: ctx.kg(T.weight) }) : ''}${T.maxLoad !== '' && T.maxLoad != null ? tr('pdf.maxLoad', { w: ctx.kg(+T.maxLoad) }) : ''}${T.noStack ? tr('pdf.noStack') : ''}`, cx + 16, y + 13, { size: 8.5, color: FAINT, baseline: 'top' });
      y += 30;
    }
    if (wNew > 0) {
      p.text(tr('pdf.layerWeight', { w: ctx.kg(wNew) }), cx, y, { size: 9.5, bold: true, color: INK, baseline: 'top' });
      y += 20;
    }
    if (nCont) {
      y += 2;
      p.fillRect(cx, y + 1, 10, 10, '#9aa3ae');
      p.hatch(cx, y + 1, 10, 10, '#ffffff', 3.5, 1);
      p.text(tr('pdf.fromBefore', { n: f(nCont, 0), c: nCont }), cx + 16, y, { size: 9.5, color: MUTED, baseline: 'top' });
      p.text(tr('pdf.hatched'), cx + 16, y + 13, { size: 8.5, color: FAINT, baseline: 'top' });
    }
    footer(p, W, H, pageNo, total);
  }

  // ---- Portada -------------------------------------------------------------------

  async function drawCover(p, putImage, W, H, o, pageNo, total) {
    const R = ctx.result, S = R.snapshot, u = ctx.unitName(S.unit), f = ctx.fmt;
    const multi = ctx.isMulti(), B = ctx.binAt(ctx.ui.bin);
    const view = Object.assign({ tare: R.tare, maxWeight: R.maxWeight }, B);
    p.fillRect(0, 0, W, H, '#ffffff');
    p.text(tr('pdf.title'), M, M, { size: 24, bold: true, color: INK, baseline: 'top' });
    const date = new Date(R.date || Date.now()).toLocaleString(I18n.locale(), { dateStyle: 'long', timeStyle: 'short' });
    p.text(tr('pdf.calculated', { app: tr('app.title'), date }), M, M + 32, { size: 9.5, color: MUTED, baseline: 'top' });
    p.lines([[M, M + 50, W - M, M + 50]], RULE, 0.8);

    const imgW = o.with3d && ctx.viewer ? Math.min(360, (W - 2 * M) * 0.46) : 0;
    const colW = W - 2 * M - (imgW ? imgW + 24 : 0);
    let y = M + 64;
    const section = t => { p.text(t.toUpperCase(), M, y, { size: 8.5, bold: true, color: FAINT, baseline: 'top' }); y += 15; };
    const line = (t, opt) => { p.text(fitText(p, t, 10, false, colW), M, y, Object.assign({ size: 10, color: INK, baseline: 'top' }, opt)); y += 15; };

    section(tr('pdf.sec.container'));
    line(`${f(S.container.w)} × ${f(S.container.h)} × ${f(S.container.d)} ${u} (${tr('dims.whd')}) · ${ctx.volText(R.containerVolume, S.unit)}`);
    y += 8;
    section(tr('pdf.sec.config'));
    const supportTxt = S.support > 0 ? tr('sup.pct', { p: f(S.support * 100, 0) }) : tr('pdf.sup.none');
    line(tr('pdf.config', { mode: tr(S.mode === 'fixed' ? 'mode.fixed' : 'mode.max'), prio: tr(S.objective === 'count' ? 'pdf.prio.count' : 'pdf.prio.volume'), sup: supportTxt }));
    if (R.maxWeight != null) line(tr('pdf.maxW', { w: ctx.kg(R.maxWeight) }) + (R.tare > 0 ? tr('pdf.maxWTare', { t: ctx.kg(R.tare) }) : ''));
    y += 8;

    // Indicadores
    section(tr('pdf.sec.result'));
    const hasW = R.weight > 0 || R.maxWeight != null;
    const kpis = multi ? [
      [f(R.nBins, 0), tr('kpi.bins', { n: R.nBins })],
      [f(R.count, 0), tr('kpi.total')],
      [ctx.pct(R.utilization), tr('kpi.avg')]
    ] : [
      [f(B.count, 0), tr('kpi.placed')],
      [ctx.pct(B.utilization), tr('kpi.vol')],
      [`${f(B.top)} ${u}`, tr('kpi.height', { h: f(S.container.h) })]
    ];
    if (multi) {
      if (hasW) kpis.push([`${f(R.weight, 1)} kg`, tr('kpi.boxesW')]);
    } else if (hasW) {
      kpis[1][1] = tr('kpi.volShort');
      kpis[2][1] = tr('kpi.heightShort', { h: f(S.container.h) });
      kpis.push([`${f(B.weight + (R.tare || 0), 1)} kg`, R.maxWeight != null ? tr('kpi.maxOf', { w: f(R.maxWeight, 1) }) : tr('kpi.totalW')]);
    }
    const kw = Math.min(150, (colW - 8 * (kpis.length - 1)) / kpis.length);
    kpis.forEach(([v, l], i) => {
      const x = M + i * (kw + 8);
      p.fillRect(x, y, kw, 46, '#f4f6f9');
      p.strokeRect(x, y, kw, 46, RULE, 0.6);
      p.text(v, x + 10, y + 8, { size: 16, bold: true, color: INK, baseline: 'top' });
      p.text(fitText(p, l, 8.5, false, kw - 16), x + 10, y + 30, { size: 8.5, color: MUTED, baseline: 'top' });
    });
    y += 58;
    if (multi) {
      if (R.auto && R.complete) line(tr('pdf.need', { n: R.nBins }) +
        (R.nBins <= R.lowerBound ? tr('pdf.need.min') : tr('pdf.need.lb', { lb: R.lowerBound })), { size: 9.5, bold: true, color: INK });
      for (const g of ctx.binGroups()) {
        if (y > H - 160) { line('…', { size: 9.5, color: MUTED }); break; }
        const b = R.bins[g.src], k = g.to - g.from + 1;
        const label = k > 1 ? tr('pdf.group', { a: g.from + 1, b: g.to + 1, k }) : tr('pdf.groupOne', { a: g.from + 1 });
        line(tr('pdf.groupLine', { label, n: f(b.count, 0), each: k > 1 ? ' ' + tr('each') : '', p: ctx.pct(b.utilization) }) +
          (hasW ? ` · ${ctx.kg(b.weight + (R.tare || 0))}` : ''), { size: 9.5, color: MUTED });
      }
      y += 4;
    } else {
      const cog = ctx.cogText(view, S, u);
      if (cog) { line(cog, { size: 9.5, color: MUTED }); y += 4; } else y += 2;
    }

    // Tabla de tipos
    const cols = [M, M + colW * 0.46, M + colW * 0.76, colW + M];
    p.text(tr('th.type'), cols[0], y, { size: 8.5, bold: true, color: MUTED, baseline: 'top' });
    p.text(tr('th.dims'), cols[1], y, { size: 8.5, bold: true, color: MUTED, baseline: 'top' });
    p.text(tr(multi ? 'th.total' : 'th.placed'), cols[2] + 40, y, { size: 8.5, bold: true, color: MUTED, align: 'right', baseline: 'top' });
    p.text(tr(S.mode === 'fixed' ? 'th.req' : 'th.max'), cols[3], y, { size: 8.5, bold: true, color: MUTED, align: 'right', baseline: 'top' });
    y += 14;
    p.lines([[M, y, M + colW, y]], RULE, 0.6);
    y += 6;
    const unplaced = [];
    S.types.forEach((t, i) => {
      if (!t.enabled) return;
      if (y > H - 110) return;
      const req = R.requested[i];
      p.fillRect(cols[0], y + 1, 9, 9, t.color);
      p.text(fitText(p, t.name + (t.noStack ? tr('pdf.noStackName') : ''), 10, true, cols[1] - cols[0] - 22), cols[0] + 15, y, { size: 10, bold: true, color: INK, baseline: 'top' });
      p.text(`${f(t.w)} × ${f(t.h)} × ${f(t.d)}${t.weight > 0 ? ` · ${f(t.weight)} kg` : ''}`, cols[1], y, { size: 10, color: INK, baseline: 'top' });
      p.text(f(R.placed[i], 0), cols[2] + 40, y, { size: 10, bold: true, color: INK, align: 'right', baseline: 'top' });
      p.text(req == null || !isFinite(req) ? '—' : f(req, 0), cols[3], y, { size: 10, color: MUTED, align: 'right', baseline: 'top' });
      y += 17;
      const left = R.leftover ? R.leftover[i] : null;
      if (S.mode === 'fixed' && left > 0) unplaced.push(`${f(left, 0)} × ${t.name}`);
    });
    y += 10;
    if (unplaced.length) {
      p.text(fitText(p, tr('pdf.notFit', { list: unplaced.join(', ') }), 9.5, true, colW), M, y, { size: 9.5, bold: true, color: '#b45309', baseline: 'top' });
      y += 18;
    }

    // Cómo leer las páginas
    const layers = ctx.getLayers(o.axis, ctx.ui.bin);
    if (y < H - 100) {
      section(tr('pdf.sec.howto'));
      const tips = [
        multi ? tr('pdf.tip.bins') : '',
        tr('pdf.tip.axis', { axis: ctx.axisText[o.axis].name, dir: ctx.axisText[o.axis].dir, count: multi ? '' : tr('pdf.tip.axisCount', { n: layers.length }) }),
        tr('pdf.tip.cut', { u }),
        tr('pdf.tip.hatch'),
        o.with3d && ctx.viewer ? tr('pdf.tip.3d') : '',
        B.cog && o.with3d && ctx.viewer ? tr('pdf.tip.cg') : '',
        multi && imgW ? tr('pdf.tip.coverBin', { k: ctx.ui.bin + 1 }) : ''
      ].filter(Boolean);
      for (const tip of tips) { if (y > H - 50) break; line('• ' + tip, { size: 9.5, color: MUTED }); }
    }

    if (imgW) {
      const ih = Math.min(H - 2 * M - 90, imgW * 0.9);
      const pxW = Math.round(imgW * 2.2), pxH = Math.round(ih * 2.2);
      const img = render3D(o, null, pxW, pxH);
      if (img) await place3D(p, putImage, img, pxW, pxH, W - M - imgW, M + 64, imgW, ih);
    }
    footer(p, W, H, pageNo, total);
  }

  // ---- Exportadores ------------------------------------------------------------------

  function layerIndexes(o, bin) {
    if (bin == null) bin = ctx.ui.bin;
    const layers = ctx.getLayers(o.axis, bin);
    if (!layers.length) return [];
    if (o.range === 'current') return [o.axis === ctx.ui.axis && bin === ctx.ui.bin ? Math.min(ctx.ui.layer, layers.length - 1) : 0];
    return layers.map((_, i) => i);
  }

  // Contenedores a exportar: todos (agrupando los idénticos) o solo el actual.
  function binPlan(o) {
    if (!ctx.isMulti() || o.bins === 'current') {
      const k = ctx.ui.bin;
      return [ctx.isMulti() ? { from: k, to: k, src: ctx.result.bins[k].sameAs != null ? ctx.result.bins[k].sameAs : k } : null];
    }
    return ctx.binGroups();
  }

  async function exportPdf(o, status) {
    const [W, H] = PAPER[o.paper] || PAPER.a4;
    const pdf = new MiniPdf();
    const plan = binPlan(o).map(g => ({ g, idx: layerIndexes(o, g ? g.src : ctx.ui.bin) }));
    const total = plan.reduce((a, q) => a + q.idx.length, 0) + (o.cover ? 1 : 0);
    const putImage = (url, pxW, pxH, x, y, w, h, page) => page.image(pdf.addJpeg(url, pxW, pxH), x, y, w, h);
    let pageNo = 0;
    try {
      if (o.cover) {
        status(tr('st.cover')); await tick();
        ctx.showBin(ctx.ui.bin);
        const pg = new PdfPainter(pdf, pdf.addPage(W, H));
        await drawCover(pg, (...a) => putImage(...a, pg), W, H, o, ++pageNo, total);
      }
      for (const { g, idx } of plan) {
        if (g) ctx.showBin(g.src);
        for (const i of idx) {
          status(tr('st.page', { bin: g ? tr('st.pageBin', { k: g.from + 1 }) : '', i: i + 1, p: pageNo + 1, n: total })); await tick();
          const pg = new PdfPainter(pdf, pdf.addPage(W, H));
          await drawLayerPage(pg, (...a) => putImage(...a, pg), W, H, o, i, ++pageNo, total, g);
        }
      }
    } finally {
      ctx.showBin(ctx.ui.bin);
    }
    status(tr('st.saving')); await tick();
    const blob = await pdf.toBlob({ title: tr('pdf.docTitle'), producer: tr('app.title') });
    download(blob, `${tr('file.layers')}-${o.axis}-${stamp()}.pdf`);
  }

  async function exportLayerPng(o, status) {
    status(tr('st.image')); await tick();
    const [W, H] = PAPER.a4, k = 2;
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const c2 = cv.getContext('2d');
    c2.scale(k, k);
    const p = new LayerView.CanvasPainter(c2);
    const putImage = (url, pxW, pxH, x, y, w, h) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { c2.drawImage(im, x, y, w, h); res(); };
      im.onerror = rej;
      im.src = url;
    });
    const i = layerIndexes(Object.assign({}, o, { range: 'current' }))[0];
    const g = binPlan(Object.assign({}, o, { bins: 'current' }))[0];
    await drawLayerPage(p, putImage, W, H, o, i, 0, 0, g);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    download(blob, `${g ? `${tr('file.container')}-${g.from + 1}-` : ''}${tr('file.layer')}-${i + 1}-${o.axis}-${stamp()}.png`);
  }

  async function export3dPng(status) {
    status(tr('st.image')); await tick();
    const url = ctx.viewer.snapshot('image/png');
    const blob = await (await fetch(url)).blob();
    download(blob, `${tr('file.view3d')}-${stamp()}.png`);
  }

  // ---- Diálogo -----------------------------------------------------------------------

  function readOptions() {
    return {
      fmt: document.querySelector('input[name="exp-fmt"]:checked').value,
      axis: $('#exp-axis').value,
      range: $('#exp-range').value,
      bins: $('#exp-bins').value,
      paper: $('#exp-paper').value,
      cover: $('#exp-cover').checked,
      with3d: $('#exp-3d').checked && !!ctx.viewer,
      before: $('#exp-before').checked
    };
  }

  function refreshDialog() {
    const o = readOptions();
    for (const el of document.querySelectorAll('#export-dialog [data-for]')) {
      el.hidden = !el.dataset.for.split(' ').includes(o.fmt);
    }
    $('#exp-before').disabled = !$('#exp-3d').checked || !ctx.viewer;
    $('#exp-bins-row').hidden = $('#exp-bins-row').hidden || !ctx.isMulti();
    const n = ctx.getLayers(o.axis).length;
    const info = $('#exp-info');
    if (o.fmt === 'pdf') {
      const plan = binPlan(o);
      const pages = plan.reduce((a, g) => a + layerIndexes(o, g ? g.src : ctx.ui.bin).length, 0) + (o.cover ? 1 : 0);
      info.textContent = tr('dlg.info.pages', { n: pages }) + (ctx.isMulti() && o.bins !== 'current'
        ? tr('dlg.info.plans', { k: plan.length, n: ctx.result.nBins })
        : tr('dlg.info.layers', { n }));
    } else if (o.fmt === 'png-layer') {
      const i = layerIndexes(Object.assign({}, o, { range: 'current' }))[0] || 0;
      info.textContent = tr('dlg.info.layer', { i: i + 1, n }) + (o.axis !== ctx.ui.axis ? tr('dlg.info.otherAxis') : '.');
    } else info.textContent = tr('dlg.info.3d');
  }

  function setStatus(t, kind) {
    const el = $('#exp-status');
    el.textContent = t || '';
    el.className = 'msg ' + (kind || 'info');
    el.hidden = !t;
  }

  function open(context) {
    ctx = context;
    const dlg = $('#export-dialog');
    $('#exp-axis').value = ctx.ui.axis;
    const no3d = !ctx.viewer;
    $('#exp-3d').disabled = no3d;
    document.querySelector('input[name="exp-fmt"][value="png-3d"]').disabled = no3d;
    if (no3d && readOptions().fmt === 'png-3d') document.querySelector('input[name="exp-fmt"][value="pdf"]').checked = true;
    setStatus(ctx.stale ? tr('dlg.stale') : '', 'warn');
    refreshDialog();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function close() {
    const dlg = $('#export-dialog');
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
  }

  function bind() {
    const dlg = $('#export-dialog');
    dlg.addEventListener('change', refreshDialog);
    dlg.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    $('#exp-cancel').addEventListener('click', () => { if (!busy) close(); });
    $('#export-form').addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      const go = $('#exp-go');
      go.disabled = true;
      const o = readOptions();
      try {
        if (o.fmt === 'pdf') await exportPdf(o, t => setStatus(t));
        else if (o.fmt === 'png-layer') await exportLayerPng(o, t => setStatus(t));
        else await export3dPng(t => setStatus(t));
        setStatus('');
        close();
      } catch (err) {
        console.error(err);
        setStatus(tr('dlg.error', { e: err && err.message ? err.message : err }), 'error');
      } finally {
        busy = false;
        go.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  root.Exporter = { open };
})(window);
