/*
 * Organizador de espacios — vista 2D de una capa (corte del contenedor).
 *
 *   eje Y (capas horizontales): vista superior, X → derecha, Z → abajo (frente abajo)
 *   eje Z (capas frontales):    vista frontal,  X → derecha, Y → arriba
 *   eje X (capas laterales):    vista lateral izquierda, Z → derecha, Y → arriba
 *
 * El diagrama se dibuja mediante un "pintor" (CanvasPainter aquí, PdfPainter en
 * pdf.js) para que la pantalla, el PNG y el PDF compartan el mismo código.
 */
(function (root) {
  'use strict';

  const AXES = {
    y: { u: 'x', us: 'w', v: 'z', vs: 'd', down: true, uLabel: 'X · ancho', vLabel: 'Z · fondo' },
    z: { u: 'x', us: 'w', v: 'y', vs: 'h', down: false, uLabel: 'X · ancho', vLabel: 'Y · alto' },
    x: { u: 'z', us: 'd', v: 'y', vs: 'h', down: false, uLabel: 'Z · fondo', vLabel: 'Y · alto' }
  };

  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  function textColor(hex) {
    const [r, g, b] = root.OrgColor.hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#1b1f24' : '#ffffff';
  }

  // ---- Pintor sobre Canvas 2D ----------------------------------------------
  class CanvasPainter {
    constructor(ctx, fontFamily) { this.ctx = ctx; this.family = fontFamily || FONT; }
    _font(size, bold) { return `${bold ? '600 ' : ''}${size}px ${this.family}`; }
    fillRect(x, y, w, h, color, alpha) {
      const c = this.ctx;
      c.globalAlpha = alpha == null ? 1 : alpha;
      c.fillStyle = color; c.fillRect(x, y, w, h);
      c.globalAlpha = 1;
    }
    strokeRect(x, y, w, h, color, lw) {
      const c = this.ctx;
      c.strokeStyle = color; c.lineWidth = lw || 1; c.strokeRect(x, y, w, h);
    }
    lines(segs, color, lw) {
      const c = this.ctx;
      c.strokeStyle = color; c.lineWidth = lw || 1;
      c.beginPath();
      for (const s of segs) { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); }
      c.stroke();
    }
    hatch(x, y, w, h, color, spacing, lw) {
      const c = this.ctx;
      c.save();
      c.beginPath(); c.rect(x, y, w, h); c.clip();
      const segs = [];
      for (let k = -h; k < w; k += spacing) segs.push([x + k, y + h, x + k + h, y]);
      this.lines(segs, color, lw);
      c.restore();
    }
    image(src, x, y, w, h) { this.ctx.drawImage(src, x, y, w, h); }
    measure(str, size, bold) { this.ctx.font = this._font(size, bold); return this.ctx.measureText(str).width; }
    // opt: { size, bold, color, align: left|center|right, baseline: top|middle|bottom, rotate (rad) }
    text(str, x, y, opt) {
      const c = this.ctx;
      c.save();
      c.font = this._font(opt.size || 11, opt.bold);
      c.fillStyle = opt.color || '#000';
      c.textAlign = opt.align || 'left';
      c.textBaseline = opt.baseline || 'alphabetic';
      c.translate(x, y);
      if (opt.rotate) c.rotate(opt.rotate);
      c.fillText(str, 0, 0);
      c.restore();
    }
  }

  // ---- Diagrama de una capa -------------------------------------------------
  // frame: {x,y,w,h} · d: datos de la capa · T: tema
  // opt: { scale (tamaño de texto), hover (índice), arrows (usar flechas unicode) }
  function drawDiagram(p, frame, d, T, opt) {
    opt = opt || {};
    const k = opt.scale || 1;
    const A = AXES[d.axis], C = d.container;
    const U = C[A.us], V = C[A.vs];
    const ml = 56 * k, mr = 18 * k, mt = 16 * k, mb = 44 * k;
    const s = Math.min((frame.w - ml - mr) / U, (frame.h - mt - mb) / V);
    const rects = [];
    if (!(s > 0)) return { rects };
    const ox = frame.x + ml + (frame.w - ml - mr - U * s) / 2, oy = frame.y + mt + (frame.h - mt - mb - V * s) / 2;
    const X = u => ox + u * s;
    const Y = v => A.down ? oy + v * s : oy + (V - v) * s;

    // Fondo del contenedor + rejilla
    p.fillRect(ox, oy, U * s, V * s, T.empty);
    const step = root.OrgColor.niceStep(Math.max(U, V), 10);
    const grid = [];
    for (let u = step; u < U - 1e-9; u += step) grid.push([X(u), oy, X(u), oy + V * s]);
    for (let v = step; v < V - 1e-9; v += step) grid.push([ox, Y(v), ox + U * s, Y(v)]);
    p.lines(grid, T.grid, k);

    // Cajas
    const items = d.items || [];
    const fs = 11 * k;
    for (const vis of (d.visible || [])) {
      const it = items[vis.i];
      const u0 = it[A.u], u1 = u0 + it[A.us], v0 = it[A.v], v1 = v0 + it[A.vs];
      const x0 = X(u0), x1 = X(u1), ya = Y(v0), yb = Y(v1);
      const rx = Math.min(x0, x1), ry = Math.min(ya, yb), rw = Math.abs(x1 - x0), rh = Math.abs(yb - ya);
      const g = Math.min(k, rw / 6, rh / 6);
      const bx = rx + g, by = ry + g, bw = rw - 2 * g, bh = rh - 2 * g;
      const col = d.colors[it.t] || '#888888';
      p.fillRect(bx, by, bw, bh, col, vis.cont ? 0.55 : 1);
      if (vis.cont) p.hatch(bx, by, bw, bh, 'rgba(255,255,255,0.6)', 7 * k, 2 * k);
      const hov = vis.i === opt.hover;
      p.strokeRect(bx + 0.5 * k, by + 0.5 * k, Math.max(0, bw - k), Math.max(0, bh - k), hov ? '#1a73e8' : T.edge, hov ? 2.5 : k);
      rects.push({ i: vis.i, x: rx, y: ry, w: rw, h: rh });

      if (rw > 34 * k && rh > 16 * k) {
        const name = d.names[it.t] || '';
        const dims = `${d.fmt(it[A.us])}×${d.fmt(it[A.vs])}`;
        const lines = [];
        if (rh > 30 * k && p.measure(name, fs, true) < rw - 6 * k) lines.push(name);
        if (p.measure(dims, fs, true) < rw - 6 * k) lines.push(dims);
        if (it.count > 1 && rh > 44 * k) lines.push(`${it.count} cajas`);
        const tc = textColor(col);
        lines.forEach((t, j) => p.text(t, rx + rw / 2, ry + rh / 2 + (j - (lines.length - 1) / 2) * 13 * k,
          { size: fs, bold: true, color: tc, align: 'center', baseline: 'middle' }));
      }
    }

    // Marco
    p.strokeRect(ox, oy, U * s, V * s, T.frame, 2 * k);

    // Reglas
    const label = Math.max(step, root.OrgColor.niceStep(Math.max(U, V), Math.max(2, Math.min(frame.w, frame.h) / (70 * k))));
    const ticks = [];
    for (let u = 0; u <= U + 1e-9; u += label) {
      ticks.push([X(u), oy + V * s, X(u), oy + V * s + 5 * k]);
      p.text(d.fmt(u), X(u), oy + V * s + 7 * k, { size: fs, color: T.text, align: 'center', baseline: 'top' });
    }
    for (let v = 0; v <= V + 1e-9; v += label) {
      ticks.push([ox - 5 * k, Y(v), ox, Y(v)]);
      p.text(d.fmt(v), ox - 8 * k, Y(v), { size: fs, color: T.text, align: 'right', baseline: 'middle' });
    }
    p.lines(ticks, T.frame, k);
    p.text(`${A.uLabel} (${d.unit})`, ox + U * s / 2, frame.y + frame.h - 4 * k,
      { size: fs, bold: true, color: T.text, align: 'center', baseline: 'bottom' });
    const dir = opt.arrows === false ? (A.down ? ' (hacia abajo)' : '') : (A.down ? ' ↓' : ' ↑');
    p.text(`${A.vLabel} (${d.unit})${dir}`, Math.max(frame.x + 12 * k, ox - 44 * k), oy + V * s / 2,
      { size: fs, bold: true, color: T.text, align: 'center', baseline: 'middle', rotate: -Math.PI / 2 });

    if (!items.length) {
      p.text(d.emptyText || 'Sin cajas', ox + U * s / 2, oy + V * s / 2, { size: 13 * k, color: T.text, align: 'center', baseline: 'middle' });
    }
    return { rects, box: { x: ox, y: oy, w: U * s, h: V * s } };
  }

  // ---- Vista en pantalla ----------------------------------------------------
  class LayerView {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.painter = new CanvasPainter(this.ctx);
      this.tooltip = opts.tooltip || null;
      this.describe = opts.describe || null;
      this.data = null;
      this.rects = [];
      this.hover = -1;
      this.theme = { bg: '#ffffff', empty: '#f3f5f8', grid: 'rgba(0,0,0,0.07)', frame: '#39424e', text: '#4a5563', edge: 'rgba(0,0,0,0.55)' };
      this._ro = new ResizeObserver(() => this.draw());
      this._ro.observe(canvas);
      canvas.addEventListener('pointermove', e => this._move(e));
      canvas.addEventListener('pointerleave', () => { this.hover = -1; if (this.tooltip) this.tooltip.hidden = true; this.draw(); });
    }

    setTheme(t) { Object.assign(this.theme, t); this.draw(); }

    // data: { container, items, colors, names, unit, fmt, axis, visible:[{i,cont}], emptyText }
    set(data) { this.data = data; this.hover = -1; this.draw(); }

    draw() {
      const cv = this.canvas, ctx = this.ctx;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = this.theme.bg;
      ctx.fillRect(0, 0, W, H);
      this.rects = [];
      if (!this.data) return;
      this.rects = drawDiagram(this.painter, { x: 0, y: 0, w: W, h: H }, this.data, this.theme, { hover: this.hover }).rects;
    }

    _move(e) {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let hit = -1;
      for (const q of this.rects) if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) { hit = q.i; }
      if (hit !== this.hover) { this.hover = hit; this.draw(); }
      if (!this.tooltip) return;
      if (hit < 0 || !this.describe) { this.tooltip.hidden = true; return; }
      this.tooltip.innerHTML = this.describe(hit);
      this.tooltip.hidden = false;
      const tw = this.tooltip.offsetWidth, th = this.tooltip.offsetHeight;
      this.tooltip.style.left = Math.min(x + 14, r.width - tw - 4) + 'px';
      this.tooltip.style.top = Math.min(y + 14, r.height - th - 4) + 'px';
    }
  }

  root.LayerView = LayerView;
  root.LayerView.AXES = AXES;
  root.LayerView.drawDiagram = drawDiagram;
  root.LayerView.CanvasPainter = CanvasPainter;
  root.LayerView.textColor = textColor;
})(window);
