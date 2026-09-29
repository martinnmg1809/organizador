/*
 * Organizador de espacios — visor 3D (WebGL puro, sin dependencias).
 *
 * Estados por caja (Uint8Array):
 *   0 normal · 1 en la capa (empieza aquí) · 2 en la capa (viene de antes)
 *   3 fantasma (otra capa, translúcida) · 4 capa anterior sólida · 5 oculta
 */
(function (root) {
  'use strict';

  // ---- Matrices 4×4 (column-major) ---------------------------------------
  const M4 = {
    perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    },
    lookAt(e, c, u) {
      let z0 = e[0] - c[0], z1 = e[1] - c[1], z2 = e[2] - c[2];
      let l = 1 / Math.hypot(z0, z1, z2); z0 *= l; z1 *= l; z2 *= l;
      let x0 = u[1] * z2 - u[2] * z1, x1 = u[2] * z0 - u[0] * z2, x2 = u[0] * z1 - u[1] * z0;
      l = Math.hypot(x0, x1, x2) || 1; x0 /= l; x1 /= l; x2 /= l;
      const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
      return new Float32Array([
        x0, y0, z0, 0, x1, y1, z1, 0, x2, y2, z2, 0,
        -(x0 * e[0] + x1 * e[1] + x2 * e[2]), -(y0 * e[0] + y1 * e[1] + y2 * e[2]), -(z0 * e[0] + z1 * e[1] + z2 * e[2]), 1
      ]);
    },
    mul(a, b) {
      const o = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    },
    invert(a) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
      const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
      const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1 / det;
      return new Float32Array([
        (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
        (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
        (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
        (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
        (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
        (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
        (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
        (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det
      ]);
    },
    apply(m, v) {
      const o = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) o[j] = m[j] * v[0] + m[4 + j] * v[1] + m[8 + j] * v[2] + m[12 + j] * v[3];
      return o;
    }
  };

  // ---- Geometría de caja ---------------------------------------------------
  // Esquina c: bit0 = x1, bit1 = y1, bit2 = z1.
  const FACES = [
    { n: [1, 0, 0], c: [1, 3, 7, 5] }, { n: [-1, 0, 0], c: [0, 2, 6, 4] },
    { n: [0, 1, 0], c: [2, 3, 7, 6] }, { n: [0, -1, 0], c: [0, 1, 5, 4] },
    { n: [0, 0, 1], c: [4, 5, 7, 6] }, { n: [0, 0, -1], c: [0, 1, 3, 2] }
  ];
  const corner = i => [i & 1, (i >> 1) & 1, (i >> 2) & 1];
  // Asegura orden antihorario visto desde fuera.
  for (const f of FACES) {
    const [a, b, c] = f.c.map(corner);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] < 0) f.c.reverse();
  }
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

  function hexToRgb(hex) {
    const h = (hex || '#888888').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const mix = (c, d, t) => [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t];

  function niceStep(span, target) {
    const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
    return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p;
  }

  // ---- Shaders -------------------------------------------------------------
  const MESH_VS = `
    attribute vec3 aPos; attribute vec3 aNorm; attribute vec4 aCol;
    uniform mat4 uMVP; varying vec3 vN; varying vec4 vC;
    void main() { gl_Position = uMVP * vec4(aPos, 1.0); vN = aNorm; vC = aCol; }`;
  const MESH_FS = `
    precision mediump float; varying vec3 vN; varying vec4 vC;
    void main() {
      vec3 n = normalize(vN);
      float l = 0.52 + 0.38 * max(dot(n, normalize(vec3(0.45, 0.85, 0.6))), 0.0)
                     + 0.14 * max(dot(n, normalize(vec3(-0.6, 0.3, -0.5))), 0.0);
      gl_FragColor = vec4(vC.rgb * l, vC.a);
    }`;
  const LINE_VS = `
    attribute vec3 aPos; attribute vec4 aCol; uniform mat4 uMVP; varying vec4 vC;
    void main() { gl_Position = uMVP * vec4(aPos, 1.0); vC = aCol; }`;
  const LINE_FS = `precision mediump float; varying vec4 vC; void main() { gl_FragColor = vC; }`;

  function compile(gl, vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  // ---- Visor ---------------------------------------------------------------
  class Viewer3D {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.tooltip = opts.tooltip || null;
      this.labels = opts.labels || null;       // contenedor de etiquetas HTML
      this.describe = opts.describe || null;   // (index) => html
      this.gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
      if (!this.gl) { this.failed = true; return; }
      const gl = this.gl;
      this.meshProg = compile(gl, MESH_VS, MESH_FS);
      this.lineProg = compile(gl, LINE_VS, LINE_FS);
      this.buf = {};
      for (const k of ['opaque', 'ghost', 'edgeOpaque', 'edgeGhost', 'frame', 'plane', 'planeEdge', 'hover']) {
        this.buf[k] = { b: gl.createBuffer(), n: 0 };
      }
      this.fov = 40 * Math.PI / 180;
      this.cam = { theta: 0.65, phi: 0.5, dist: 300, target: [0, 0, 0] };
      this.scene = null;
      this.states = null;
      this.ghostOpacity = 0.12;
      this.plane = null;
      this.hover = -1;
      this.theme = { bg: [0.96, 0.97, 0.98], grid: [0, 0, 0, 0.08], frame: [0.2, 0.25, 0.3, 0.8], edge: [0, 0, 0, 0.45], accent: [0.15, 0.45, 0.95] };
      this._bindEvents();
      this._autoFit = true;
      this._view = 'iso';
      this._ro = new ResizeObserver(() => { if (this._autoFit) this.setView(this._view); else this.requestRender(); });
      this._ro.observe(canvas);
      this.requestRender();
    }

    setTheme(t) { Object.assign(this.theme, t); this._buildFrame(); this._buildGeometry(); this.requestRender(); }

    // scene: { container:{w,h,d}, items:[{t,x,y,z,w,h,d}], colors:['#hex'...] }
    setScene(scene, keepCamera) {
      this.scene = scene;
      this.states = null;
      this.hover = -1;
      this._buildFrame();
      this._buildGeometry();
      if (!keepCamera) this.resetView();
      this.requestRender();
    }

    setStates(states, ghostOpacity, plane) {
      this.states = states;
      if (ghostOpacity != null) this.ghostOpacity = ghostOpacity;
      this.plane = plane || null;   // { axis:'x'|'y'|'z', pos }
      this._buildGeometry();
      this._buildPlane();
      this.requestRender();
    }

    setColors(colors) {
      if (!this.scene) return;
      this.scene.colors = colors;
      this._buildGeometry();
      this.requestRender();
    }

    size() {
      const C = this.scene ? this.scene.container : { w: 100, h: 100, d: 100 };
      return C;
    }

    resetView() { this.setView('iso'); }

    setView(name) {
      const C = this.size();
      const views = { iso: [0.65, 0.5], front: [0, 0.02], top: [0, 1.5607], side: [-Math.PI / 2, 0.02], back: [Math.PI, 0.35] };
      const v = views[name] || views.iso;
      this._view = views[name] ? name : 'iso';
      this._autoFit = true;
      this.cam.theta = v[0]; this.cam.phi = v[1];
      this.cam.target = [C.w / 2, C.h / 2, C.d / 2];
      const diag = Math.hypot(C.w, C.h, C.d);
      const aspect = Math.max(0.3, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
      const fit = diag / 2 / Math.tan(this.fov / 2);
      this.cam.dist = fit * (aspect < 1 ? 1.1 / aspect : 1.1);
      this.requestRender();
    }

    // ---- Construcción de buffers -------------------------------------------

    _upload(key, data, stride) {
      const gl = this.gl, b = this.buf[key];
      gl.bindBuffer(gl.ARRAY_BUFFER, b.b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      b.n = data.length / stride;
    }

    _gap() {
      const C = this.size();
      return Math.max(C.w, C.h, C.d) * 0.0015;
    }

    _buildGeometry() {
      if (this.failed || !this.scene) return;
      const items = this.scene.items, st = this.states, colors = this.scene.colors.map(hexToRgb);
      const n = items.length;
      let nO = 0, nG = 0;
      for (let i = 0; i < n; i++) {
        const s = st ? st[i] : 0;
        if (s === 3) nG++; else if (s !== 5) nO++;
      }
      const opaque = new Float32Array(nO * 36 * 10), ghost = new Float32Array(nG * 36 * 10);
      const eO = new Float32Array(nO * 24 * 7), eG = new Float32Array(nG * 24 * 7);
      let po = 0, pg = 0, peo = 0, peg = 0;
      const gapBase = this._gap();
      const edge = this.theme.edge;
      const white = [1, 1, 1], grey = [0.55, 0.57, 0.6];
      const ga = this.ghostOpacity;

      for (let i = 0; i < n; i++) {
        const s = st ? st[i] : 0;
        if (s === 5) continue;
        const it = items[i];
        const g = Math.min(gapBase, it.w * 0.08, it.h * 0.08, it.d * 0.08);
        const x0 = it.x + g, y0 = it.y + g, z0 = it.z + g, x1 = it.x + it.w - g, y1 = it.y + it.h - g, z1 = it.z + it.d - g;
        const P = c => [(c & 1) ? x1 : x0, (c & 2) ? y1 : y0, (c & 4) ? z1 : z0];
        let rgb = colors[it.t] || [0.5, 0.5, 0.5], a = 1;
        if (s === 2) rgb = mix(rgb, white, 0.3);
        else if (s === 4) rgb = mix(rgb, grey, 0.55);
        else if (s === 3) a = ga;
        const ghostMode = s === 3;
        const arr = ghostMode ? ghost : opaque;
        let p = ghostMode ? pg : po;
        for (const f of FACES) {
          const q = f.c.map(P);
          for (const idx of [0, 1, 2, 0, 2, 3]) {
            const v = q[idx];
            arr[p++] = v[0]; arr[p++] = v[1]; arr[p++] = v[2];
            arr[p++] = f.n[0]; arr[p++] = f.n[1]; arr[p++] = f.n[2];
            arr[p++] = rgb[0]; arr[p++] = rgb[1]; arr[p++] = rgb[2]; arr[p++] = a;
          }
        }
        if (ghostMode) pg = p; else po = p;

        const earr = ghostMode ? eG : eO;
        let pe = ghostMode ? peg : peo;
        const ec = ghostMode ? [rgb[0] * 0.6, rgb[1] * 0.6, rgb[2] * 0.6, Math.min(0.6, ga * 2.2)] : edge;
        for (const [ea, eb] of EDGES) {
          for (const v of [P(ea), P(eb)]) {
            earr[pe++] = v[0]; earr[pe++] = v[1]; earr[pe++] = v[2];
            earr[pe++] = ec[0]; earr[pe++] = ec[1]; earr[pe++] = ec[2]; earr[pe++] = ec[3];
          }
        }
        if (ghostMode) peg = pe; else peo = pe;
      }
      this._upload('opaque', opaque, 10);
      this._upload('ghost', ghost, 10);
      this._upload('edgeOpaque', eO, 7);
      this._upload('edgeGhost', eG, 7);
    }

    _buildFrame() {
      if (this.failed) return;
      const C = this.size(), L = [];
      const push = (a, b, c) => { L.push(a[0], a[1], a[2], c[0], c[1], c[2], c[3], b[0], b[1], b[2], c[0], c[1], c[2], c[3]); };
      // Rejilla del suelo
      const step = niceStep(Math.max(C.w, C.d), 10), gc = this.theme.grid;
      for (let x = step; x < C.w - 1e-9; x += step) push([x, 0, 0], [x, 0, C.d], gc);
      for (let z = step; z < C.d - 1e-9; z += step) push([0, 0, z], [C.w, 0, z], gc);
      // Contorno del contenedor
      const fc = this.theme.frame;
      const P = c => [(c & 1) ? C.w : 0, (c & 2) ? C.h : 0, (c & 4) ? C.d : 0];
      for (const [a, b] of EDGES) push(P(a), P(b), fc);
      // Ejes
      const len = Math.max(C.w, C.h, C.d) * 0.12;
      push([0, 0, 0], [len, 0, 0], [0.9, 0.2, 0.2, 1]);
      push([0, 0, 0], [0, len, 0], [0.2, 0.7, 0.25, 1]);
      push([0, 0, 0], [0, 0, len], [0.2, 0.4, 0.95, 1]);
      this._upload('frame', new Float32Array(L), 7);
    }

    _buildPlane() {
      if (this.failed) return;
      const C = this.size(), pl = this.plane;
      if (!pl) { this._upload('plane', new Float32Array(0), 10); this._upload('planeEdge', new Float32Array(0), 7); return; }
      const m = Math.max(C.w, C.h, C.d) * 0.03;
      let q;
      if (pl.axis === 'y') q = [[-m, pl.pos, -m], [C.w + m, pl.pos, -m], [C.w + m, pl.pos, C.d + m], [-m, pl.pos, C.d + m]];
      else if (pl.axis === 'x') q = [[pl.pos, -m, -m], [pl.pos, C.h + m, -m], [pl.pos, C.h + m, C.d + m], [pl.pos, -m, C.d + m]];
      else q = [[-m, -m, pl.pos], [C.w + m, -m, pl.pos], [C.w + m, C.h + m, pl.pos], [-m, C.h + m, pl.pos]];
      const c = this.theme.accent, n = pl.axis === 'x' ? [1, 0, 0] : pl.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
      const tri = [], ln = [];
      for (const i of [0, 1, 2, 0, 2, 3]) tri.push(...q[i], ...n, c[0], c[1], c[2], 0.13);
      for (let i = 0; i < 4; i++) ln.push(...q[i], c[0], c[1], c[2], 0.9, ...q[(i + 1) % 4], c[0], c[1], c[2], 0.9);
      this._upload('plane', new Float32Array(tri), 10);
      this._upload('planeEdge', new Float32Array(ln), 7);
    }

    _buildHover() {
      const L = [];
      if (this.hover >= 0 && this.scene) {
        const it = this.scene.items[this.hover];
        const P = c => [(c & 1) ? it.x + it.w : it.x, (c & 2) ? it.y + it.h : it.y, (c & 4) ? it.z + it.d : it.z];
        const c = this.theme.accent;
        for (const [a, b] of EDGES) L.push(...P(a), c[0], c[1], c[2], 1, ...P(b), c[0], c[1], c[2], 1);
      }
      this._upload('hover', new Float32Array(L), 7);
    }

    // ---- Dibujo ------------------------------------------------------------

    requestRender() {
      if (this.failed || this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); });
    }

    _matrices() {
      const cv = this.canvas, c = this.cam;
      const eye = [
        c.target[0] + c.dist * Math.cos(c.phi) * Math.sin(c.theta),
        c.target[1] + c.dist * Math.sin(c.phi),
        c.target[2] + c.dist * Math.cos(c.phi) * Math.cos(c.theta)
      ];
      const aspect = Math.max(1, cv.width) / Math.max(1, cv.height);
      const proj = M4.perspective(this.fov, aspect, c.dist * 0.01, c.dist * 20);
      const view = M4.lookAt(eye, c.target, [0, 1, 0]);
      return { eye, vp: M4.mul(proj, view) };
    }

    render() {
      if (this.failed) return;
      const gl = this.gl, cv = this.canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
      const bg = this.theme.bg;
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const { vp } = this._matrices();
      this.vp = vp;

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Cajas opacas
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
      gl.depthMask(true);
      this._drawMesh('opaque', vp);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      this._drawLines('edgeOpaque', vp);
      this._drawLines('frame', vp);

      // Cajas translúcidas
      gl.depthMask(false);
      this._drawMesh('ghost', vp);
      this._drawLines('edgeGhost', vp);

      // Plano de corte
      gl.disable(gl.CULL_FACE);
      this._drawMesh('plane', vp);
      this._drawLines('planeEdge', vp);

      // Caja resaltada (siempre visible)
      gl.disable(gl.DEPTH_TEST);
      this._drawLines('hover', vp);
      gl.depthMask(true);

      this._updateLabels(vp);
    }

    _drawMesh(key, vp) {
      const gl = this.gl, b = this.buf[key];
      if (!b.n) return;
      const p = this.meshProg;
      gl.useProgram(p);
      gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uMVP'), false, vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.b);
      const aPos = gl.getAttribLocation(p, 'aPos'), aNorm = gl.getAttribLocation(p, 'aNorm'), aCol = gl.getAttribLocation(p, 'aCol');
      gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aNorm); gl.enableVertexAttribArray(aCol);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 40, 24);
      gl.drawArrays(gl.TRIANGLES, 0, b.n);
      gl.disableVertexAttribArray(aNorm);
    }

    _drawLines(key, vp) {
      const gl = this.gl, b = this.buf[key];
      if (!b.n) return;
      const p = this.lineProg;
      gl.useProgram(p);
      gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uMVP'), false, vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.b);
      const aPos = gl.getAttribLocation(p, 'aPos'), aCol = gl.getAttribLocation(p, 'aCol');
      gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aCol);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
      gl.drawArrays(gl.LINES, 0, b.n);
    }

    project(p, vp) {
      const v = M4.apply(vp || this.vp, [p[0], p[1], p[2], 1]);
      if (v[3] <= 0) return null;
      return [(v[0] / v[3] * 0.5 + 0.5) * this.canvas.clientWidth, (0.5 - v[1] / v[3] * 0.5) * this.canvas.clientHeight];
    }

    _updateLabels(vp) {
      if (!this.labels || !this.scene) return;
      const C = this.size(), len = Math.max(C.w, C.h, C.d) * 0.15;
      const u = this.scene.unit || '', f = this.scene.fmt || (v => v);
      const pts = [
        ['X', [len, 0, 0], 'axis x'], ['Y', [0, len, 0], 'axis y'], ['Z', [0, 0, len], 'axis z'],
        [`${f(C.w)} ${u}`, [C.w / 2, 0, C.d], 'dim'], [`${f(C.h)} ${u}`, [C.w, C.h / 2, C.d], 'dim'], [`${f(C.d)} ${u}`, [C.w, 0, C.d / 2], 'dim']
      ];
      if (!this._labelEls) {
        this._labelEls = pts.map(() => { const s = document.createElement('span'); this.labels.appendChild(s); return s; });
      }
      pts.forEach((p, i) => {
        const el = this._labelEls[i], s = this.project(p[1], vp);
        el.className = 'v3d-label ' + p[2];
        el.textContent = p[0];
        if (!s) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -50%)`;
      });
    }

    // ---- Interacción -------------------------------------------------------

    _pick(clientX, clientY) {
      if (!this.scene || !this.vp) return -1;
      const r = this.canvas.getBoundingClientRect();
      const nx = (clientX - r.left) / r.width * 2 - 1, ny = 1 - (clientY - r.top) / r.height * 2;
      const inv = M4.invert(this.vp);
      if (!inv) return -1;
      const a = M4.apply(inv, [nx, ny, -1, 1]), b = M4.apply(inv, [nx, ny, 1, 1]);
      const o = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], e = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
      const d = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
      const items = this.scene.items, st = this.states;
      let best = -1, bt = Infinity;
      for (let i = 0; i < items.length; i++) {
        const s = st ? st[i] : 0;
        if (s === 3 || s === 5) continue;
        const it = items[i];
        let t0 = 0, t1 = bt;
        const mins = [it.x, it.y, it.z], maxs = [it.x + it.w, it.y + it.h, it.z + it.d];
        let ok = true;
        for (let k = 0; k < 3 && ok; k++) {
          if (Math.abs(d[k]) < 1e-12) { if (o[k] < mins[k] || o[k] > maxs[k]) ok = false; continue; }
          let ta = (mins[k] - o[k]) / d[k], tb = (maxs[k] - o[k]) / d[k];
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          if (ta > t0) t0 = ta;
          if (tb < t1) t1 = tb;
          if (t0 > t1) ok = false;
        }
        if (ok && t0 < bt) { bt = t0; best = i; }
      }
      return best;
    }

    _setHover(i, ev) {
      if (i !== this.hover) {
        this.hover = i;
        this._buildHover();
        this.requestRender();
      }
      if (!this.tooltip) return;
      if (i < 0 || !this.describe) { this.tooltip.hidden = true; return; }
      this.tooltip.innerHTML = this.describe(i);
      this.tooltip.hidden = false;
      const r = this.canvas.getBoundingClientRect();
      const x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
      const tw = this.tooltip.offsetWidth, th = this.tooltip.offsetHeight;
      this.tooltip.style.left = Math.min(x, r.width - tw - 4) + 'px';
      this.tooltip.style.top = Math.min(y, r.height - th - 4) + 'px';
    }

    _bindEvents() {
      const cv = this.canvas, ptrs = new Map();
      let mode = null, last = null, pinch = null;
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture(e.pointerId);
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2) {
          const [p, q] = [...ptrs.values()];
          pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), c: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] };
          mode = 'pinch';
        } else {
          mode = (e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey) ? 'pan' : 'rotate';
        }
        last = [e.clientX, e.clientY];
        this._autoFit = false;
        this._setHover(-1, e);
      });
      const end = e => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 0) mode = null;
        else if (ptrs.size === 1) { mode = 'rotate'; last = [...ptrs.values()][0]; }
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', e => { if (!mode) this._setHover(-1, e); });
      cv.addEventListener('pointermove', e => {
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (!mode) {
          if (this._pickPending) return;
          this._pickPending = true;
          requestAnimationFrame(() => { this._pickPending = false; this._setHover(this._pick(e.clientX, e.clientY), e); });
          return;
        }
        if (mode === 'pinch' && ptrs.size === 2) {
          const [p, q] = [...ptrs.values()];
          const d = Math.hypot(p[0] - q[0], p[1] - q[1]), c = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          if (pinch.d > 0) this.cam.dist *= pinch.d / Math.max(1, d);
          this._pan(c[0] - pinch.c[0], c[1] - pinch.c[1]);
          pinch = { d, c };
          this.requestRender();
          return;
        }
        const dx = e.clientX - last[0], dy = e.clientY - last[1];
        last = [e.clientX, e.clientY];
        if (mode === 'rotate') {
          this.cam.theta -= dx * 0.008;
          this.cam.phi = Math.max(-1.55, Math.min(1.5607, this.cam.phi + dy * 0.008));
        } else if (mode === 'pan') this._pan(dx, dy);
        this.requestRender();
      });
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        this._autoFit = false;
        this.cam.dist *= Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
        const C = this.size(), m = Math.max(C.w, C.h, C.d);
        this.cam.dist = Math.max(m * 0.1, Math.min(m * 20, this.cam.dist));
        this.requestRender();
      }, { passive: false });
      cv.addEventListener('dblclick', () => this.resetView());
    }

    _pan(dx, dy) {
      const c = this.cam;
      const scale = 2 * c.dist * Math.tan(this.fov / 2) / Math.max(1, this.canvas.clientHeight);
      const right = [Math.cos(c.theta), 0, -Math.sin(c.theta)];
      const up = [-Math.sin(c.phi) * Math.sin(c.theta), Math.cos(c.phi), -Math.sin(c.phi) * Math.cos(c.theta)];
      for (let k = 0; k < 3; k++) c.target[k] += (-dx * right[k] + dy * up[k]) * scale;
    }

    snapshot() { this.render(); return this.canvas.toDataURL('image/png'); }
  }

  root.Viewer3D = Viewer3D;
  root.OrgColor = { hexToRgb, mix, niceStep };
})(window);
