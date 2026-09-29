/*
 * Organizador de espacios — vista 2D de una capa (corte del contenedor).
 *
 *   eje Y (capas horizontales): vista superior, X → derecha, Z → abajo (frente abajo)
 *   eje Z (capas frontales):    vista frontal,  X → derecha, Y → arriba
 *   eje X (capas laterales):    vista lateral izquierda, Z → derecha, Y → arriba
 */
(function (root) {
  'use strict';

  const AXES = {
    y: { u: 'x', us: 'w', v: 'z', vs: 'd', down: true, uLabel: 'X · ancho', vLabel: 'Z · fondo' },
    z: { u: 'x', us: 'w', v: 'y', vs: 'h', down: false, uLabel: 'X · ancho', vLabel: 'Y · alto' },
    x: { u: 'z', us: 'd', v: 'y', vs: 'h', down: false, uLabel: 'Z · fondo', vLabel: 'Y · alto' }
  };

  function textColor(hex) {
    const [r, g, b] = root.OrgColor.hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#1b1f24' : '#ffffff';
  }

  class LayerView {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
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

    setTheme(t) { Object.assign(this.theme, t); this._hatch = null; this.draw(); }

    // data: { container, items, colors, names, unit, fmt, axis, layer:{lo,hi}|null, visible:[{i,cont}] }
    set(data) { this.data = data; this.hover = -1; this.draw(); }

    _hatchPattern() {
      if (this._hatch) return this._hatch;
      const c = document.createElement('canvas');
      c.width = c.height = 10;
      const x = c.getContext('2d');
      x.strokeStyle = 'rgba(255,255,255,0.55)';
      x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(-2, 12); x.lineTo(12, -2); x.moveTo(8, 12); x.lineTo(12, 8); x.moveTo(-2, 2); x.lineTo(2, -2); x.stroke();
      this._hatch = this.ctx.createPattern(c, 'repeat');
      return this._hatch;
    }

    draw() {
      const cv = this.canvas, ctx = this.ctx, T = this.theme;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = T.bg;
      ctx.fillRect(0, 0, W, H);
      this.rects = [];
      const d = this.data;
      if (!d) return;

      const A = AXES[d.axis], C = d.container;
      const U = C[A.us], V = C[A.vs];
      const ml = 56, mr = 18, mt = 16, mb = 44;
      const s = Math.min((W - ml - mr) / U, (H - mt - mb) / V);
      if (!(s > 0)) return;
      const ox = ml + (W - ml - mr - U * s) / 2, oy = mt + (H - mt - mb - V * s) / 2;
      const X = u => ox + u * s;
      const Y = v => A.down ? oy + v * s : oy + (V - v) * s;
      this.map = { A, s, X, Y, ox, oy, U, V };

      // Fondo del contenedor + rejilla
      ctx.fillStyle = T.empty;
      ctx.fillRect(ox, oy, U * s, V * s);
      const step = root.OrgColor.niceStep(Math.max(U, V), 10);
      ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let u = step; u < U - 1e-9; u += step) { ctx.moveTo(Math.round(X(u)) + 0.5, oy); ctx.lineTo(Math.round(X(u)) + 0.5, oy + V * s); }
      for (let v = step; v < V - 1e-9; v += step) { ctx.moveTo(ox, Math.round(Y(v)) + 0.5); ctx.lineTo(ox + U * s, Math.round(Y(v)) + 0.5); }
      ctx.stroke();

      // Cajas
      const items = d.items || [];
      const hatch = this._hatchPattern();
      ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const vis of (d.visible || [])) {
        const it = items[vis.i];
        const u0 = it[A.u], u1 = u0 + it[A.us], v0 = it[A.v], v1 = v0 + it[A.vs];
        const x0 = X(u0), x1 = X(u1), ya = Y(v0), yb = Y(v1);
        const rx = Math.min(x0, x1), ry = Math.min(ya, yb), rw = Math.abs(x1 - x0), rh = Math.abs(yb - ya);
        const g = Math.min(1, rw / 6, rh / 6);
        const col = d.colors[it.t] || '#888';
        ctx.fillStyle = col;
        ctx.globalAlpha = vis.cont ? 0.55 : 1;
        ctx.fillRect(rx + g, ry + g, rw - 2 * g, rh - 2 * g);
        ctx.globalAlpha = 1;
        if (vis.cont) { ctx.fillStyle = hatch; ctx.fillRect(rx + g, ry + g, rw - 2 * g, rh - 2 * g); }
        ctx.strokeStyle = vis.i === this.hover ? '#1a73e8' : T.edge;
        ctx.lineWidth = vis.i === this.hover ? 2.5 : 1;
        ctx.strokeRect(rx + g + 0.5, ry + g + 0.5, Math.max(0, rw - 2 * g - 1), Math.max(0, rh - 2 * g - 1));
        this.rects.push({ i: vis.i, x: rx, y: ry, w: rw, h: rh });

        if (rw > 34 && rh > 16) {
          ctx.fillStyle = textColor(col);
          const name = d.names[it.t] || '';
          const dims = `${d.fmt(it[A.us])}×${d.fmt(it[A.vs])}`;
          const lines = [];
          if (rh > 30 && ctx.measureText(name).width < rw - 6) lines.push(name);
          if (ctx.measureText(dims).width < rw - 6) lines.push(dims);
          if (it.count > 1 && rh > 44) lines.push(`${it.count} cajas`);
          lines.forEach((t, k) => ctx.fillText(t, rx + rw / 2, ry + rh / 2 + (k - (lines.length - 1) / 2) * 13));
        }
      }

      // Marco
      ctx.strokeStyle = T.frame; ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, U * s, V * s);

      // Reglas
      ctx.fillStyle = T.text; ctx.strokeStyle = T.frame; ctx.lineWidth = 1;
      ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
      const label = Math.max(step, root.OrgColor.niceStep(Math.max(U, V), Math.max(2, Math.min(W, H) / 70)));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.beginPath();
      for (let u = 0; u <= U + 1e-9; u += label) {
        ctx.moveTo(X(u), oy + V * s); ctx.lineTo(X(u), oy + V * s + 5);
        ctx.fillText(d.fmt(u), X(u), oy + V * s + 7);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = 0; v <= V + 1e-9; v += label) {
        ctx.moveTo(ox - 5, Y(v)); ctx.lineTo(ox, Y(v));
        ctx.fillText(d.fmt(v), ox - 8, Y(v));
      }
      ctx.stroke();
      ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${A.uLabel} (${d.unit})`, ox + U * s / 2, H - 4);
      ctx.save();
      ctx.translate(Math.max(12, ox - 44), oy + V * s / 2); ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'middle';
      ctx.fillText(`${A.vLabel} (${d.unit})${A.down ? ' ↓' : ' ↑'}`, 0, 0);
      ctx.restore();

      if (!items.length) {
        ctx.fillStyle = T.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '13px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.fillText(d.emptyText || 'Sin cajas', ox + U * s / 2, oy + V * s / 2);
      }
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

    snapshot() { return this.canvas.toDataURL('image/png'); }
  }

  root.LayerView = LayerView;
  root.LayerView.AXES = AXES;
})(window);
