/*
 * Organizador de espacios — motor de empaquetado 3D.
 *
 * Heurística constructiva basada en "espacios máximos vacíos" (EMS) con
 * colocación por bloques (varias cajas iguales a la vez) y búsqueda GRASP:
 * se construyen muchas soluciones con pequeñas variaciones aleatorias y se
 * conserva la mejor. Parte de las iteraciones reconstruyen solo el final de
 * la mejor solución (mejora local).
 *
 * Ejes: X = ancho, Y = alto (vertical, gravedad), Z = fondo.
 */
function OrganizadorPacker() {
  'use strict';

  let EPS = 1e-6;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Orientaciones permitidas como [dx, dy, dz] (dy = altura).
  function orientationsFor(t) {
    const w = t.w, h = t.h, d = t.d;
    let raw;
    if (t.rot === 'none') raw = [[w, h, d]];
    else if (t.rot === 'upright') raw = [[w, h, d], [d, h, w]];
    else raw = [[w, h, d], [d, h, w], [w, d, h], [h, d, w], [d, w, h], [h, w, d]];
    const out = [];
    for (const o of raw) {
      if (!out.some(p => p[0] === o[0] && p[1] === o[1] && p[2] === o[2])) out.push(o);
    }
    return out;
  }

  function prepare(input) {
    const C = input.container;
    EPS = Math.max(C.w, C.h, C.d) * 1e-9;
    const mode = input.mode === 'fixed' ? 'fixed' : 'max';
    const types = input.types.map((t, i) => {
      let qty = t.qty;
      if (t.enabled === false) qty = 0;
      else if (qty == null || qty === '' || !isFinite(qty)) qty = mode === 'fixed' ? 0 : Infinity;
      else qty = Math.max(0, Math.floor(qty));
      const oris = orientationsFor(t).filter(o => o[0] <= C.w + EPS && o[1] <= C.h + EPS && o[2] <= C.d + EPS);
      const weight = Math.max(0, +t.weight || 0);
      const ml = t.maxLoad;
      return {
        // kg que puede soportar encima (Infinity = sin límite)
        maxLoad: ml === '' || ml == null || !(+ml >= 0) ? Infinity : +ml,
        index: i, vol: t.w * t.h * t.d, qty, oris, weight,
        density: t.w * t.h * t.d > 0 ? weight / (t.w * t.h * t.d) : 0,
        minSide: Math.min(t.w, t.h, t.d), fits: oris.length > 0,
        noStack: !!t.noStack   // no se puede colocar nada encima
      };
    });
    const V = C.w * C.h * C.d;

    // Límite de peso: capacidad = peso máximo − tara del contenedor.
    const maxWeight = +input.maxWeight > 0 ? +input.maxWeight : Infinity;
    const tare = Math.max(0, +input.tare || 0);
    const wCap = maxWeight === Infinity ? Infinity : Math.max(0, maxWeight - tare);
    const WEPS = 1e-9 * (isFinite(wCap) ? Math.max(1, wCap) : 1);
    for (const t of types) t.tooHeavy = t.weight > wCap + WEPS;
    const active = types.filter(t => t.qty > 0 && t.fits && !t.tooHeavy);
    const hasWeight = types.some(t => t.weight > 0);
    // La carga soportada solo importa si hay pesos y algún tipo tiene límite.
    const hasLoad = hasWeight && active.some(t => isFinite(t.maxLoad));

    // Cotas superiores (solo sirven para parar antes si se alcanzan).
    let volBound = 0;
    for (const t of active) volBound += t.qty * t.vol;
    volBound = Math.min(V, volBound);
    let countBound = 0, cap = V;
    for (const t of active.slice().sort((a, b) => a.vol - b.vol)) {
      const k = Math.min(t.qty, Math.floor(cap / t.vol + 1e-9));
      countBound += k; cap -= k * t.vol;
    }
    if (isFinite(wCap)) {
      // Mochila fraccionaria por volumen/kg y mochila de cardinalidad por peso.
      let vb = 0, wl = wCap;
      const byRatio = active.slice().sort((a, b) => (b.weight ? b.vol / b.weight : Infinity) - (a.weight ? a.vol / a.weight : Infinity));
      for (const t of byRatio) {
        if (!t.weight) { vb += t.qty * t.vol; continue; }
        const k = Math.min(t.qty, wl / t.weight);
        vb += k * t.vol; wl -= k * t.weight;
      }
      volBound = Math.min(volBound, vb);
      let cb = 0; wl = wCap;
      for (const t of active.slice().sort((a, b) => a.weight - b.weight)) {
        if (!t.weight) { cb += t.qty; continue; }
        const k = Math.min(t.qty, Math.floor(wl / t.weight + 1e-9));
        cb += k; wl -= k * t.weight;
      }
      countBound = Math.min(countBound, cb);
    }

    // Altura mínima posible si caben todas (para parar al compactar en modo fijo).
    let minTop = 0;
    if (mode === 'fixed') {
      let tv = 0;
      for (const t of active) {
        tv += t.qty * t.vol;
        minTop = Math.max(minTop, Math.min(...t.oris.map(o => o[1])));
      }
      minTop = Math.max(minTop, tv / (C.w * C.d));
    }

    return {
      W: C.w, H: C.h, D: C.d, V, types, active, mode, minTop,
      wCap, maxWeight, tare, hasWeight, hasLoad, WEPS,
      objective: input.objective === 'count' ? 'count' : 'volume',
      support: Math.max(0, Math.min(1, +input.support || 0)),
      volBound, countBound
    };
  }

  // ---- Espacios -----------------------------------------------------------

  function selectSpace(spaces, order) {
    let bi = 0, b = spaces[0];
    for (let i = 1; i < spaces.length; i++) {
      const s = spaces[i];
      if (s.y0 < b.y0 - EPS) { bi = i; b = s; continue; }
      if (s.y0 > b.y0 + EPS) continue;
      let p1, p2, q1, q2;
      if (order === 0) { p1 = s.z0; q1 = b.z0; p2 = s.x0; q2 = b.x0; }
      else { p1 = s.x0; q1 = b.x0; p2 = s.z0; q2 = b.z0; }
      if (p1 < q1 - EPS || (Math.abs(p1 - q1) <= EPS && p2 < q2 - EPS)) { bi = i; b = s; }
    }
    return bi;
  }

  function contains(a, b) {
    return a.x0 <= b.x0 + EPS && a.y0 <= b.y0 + EPS && a.z0 <= b.z0 + EPS &&
      a.x1 >= b.x1 - EPS && a.y1 >= b.y1 - EPS && a.z1 >= b.z1 - EPS;
  }

  // ---- Carga soportada ------------------------------------------------------
  //
  // El peso baja por contacto: cada columna de cajas reparte lo que lleva entre
  // los bloques que la sostienen, en proporción al área de contacto, y así
  // sucesivamente hasta el suelo. Las cargas se guardan por columna de bloque
  // (st.loads: bloque → kg sobre cada columna).

  // Carga externa máxima sobre una columna del bloque: su caja de abajo soporta
  // además las cajas de la propia columna.
  function colCap(P, b) {
    const t = P.types[b.t];
    return t.maxLoad - (b.ny - 1) * t.weight;
  }

  // Incrementos de carga que produciría el bloque b (Map bloque → Float64Array).
  function loadIncrements(P, st, b) {
    const inc = new Map();
    const w = P.types[b.t].weight;
    if (!(w > 0)) return inc;
    const stack = [];
    for (let i = 0; i < b.nx; i++) for (let k = 0; k < b.nz; k++) {
      stack.push([b.x + i * b.dx, b.z + k * b.dz, b.dx, b.dz, b.y, b.ny * w]);
    }
    let steps = 0;
    while (stack.length) {
      const [rx, rz, rw, rd, y, d] = stack.pop();
      if (y <= EPS || d <= 1e-12) continue;
      if (++steps > 20000) return null;
      const sup = [];
      let area = 0;
      for (const s of st.blocks) {
        if (Math.abs(s.y + s.by - y) > EPS) continue;
        const x0 = Math.max(rx, s.x), x1 = Math.min(rx + rw, s.x + s.bx);
        if (x1 - x0 <= EPS) continue;
        const z0 = Math.max(rz, s.z), z1 = Math.min(rz + rd, s.z + s.bz);
        if (z1 - z0 <= EPS) continue;
        sup.push([s, x0, x1, z0, z1]);
        area += (x1 - x0) * (z1 - z0);
      }
      if (!(area > 0)) continue;
      for (const [s, x0, x1, z0, z1] of sup) {
        let arr = inc.get(s);
        if (!arr) { arr = new Float64Array(s.nx * s.nz); inc.set(s, arr); }
        const i0 = Math.max(0, Math.floor((x0 - s.x) / s.dx + 1e-9)), i1 = Math.min(s.nx - 1, Math.ceil((x1 - s.x) / s.dx - 1e-9) - 1);
        const k0 = Math.max(0, Math.floor((z0 - s.z) / s.dz + 1e-9)), k1 = Math.min(s.nz - 1, Math.ceil((z1 - s.z) / s.dz - 1e-9) - 1);
        for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
          const cx0 = Math.max(x0, s.x + i * s.dx), cx1 = Math.min(x1, s.x + (i + 1) * s.dx);
          const cz0 = Math.max(z0, s.z + k * s.dz), cz1 = Math.min(z1, s.z + (k + 1) * s.dz);
          if (cx1 - cx0 <= EPS || cz1 - cz0 <= EPS) continue;
          const dd = d * (cx1 - cx0) * (cz1 - cz0) / area;
          arr[i * s.nz + k] += dd;
          stack.push([s.x + i * s.dx, s.z + k * s.dz, s.dx, s.dz, s.y, dd]);
        }
      }
    }
    return inc;
  }

  function loadsFit(P, st, inc) {
    if (!inc) return false;
    for (const [s, arr] of inc) {
      const cap = colCap(P, s);
      if (cap === Infinity) continue;
      const cur = st.loads.get(s);
      for (let j = 0; j < arr.length; j++) if ((cur ? cur[j] : 0) + arr[j] > cap + 1e-9) return false;
    }
    return true;
  }

  function commitLoads(st, inc) {
    if (!inc) return;
    for (const [s, arr] of inc) {
      let cur = st.loads.get(s);
      if (!cur) st.loads.set(s, cur = new Float64Array(arr.length));
      for (let j = 0; j < arr.length; j++) cur[j] += arr[j];
    }
  }

  function applyBlock(P, st, b) {
    if (P.hasLoad) commitLoads(st, loadIncrements(P, st, b));
    st.blocks.push(b);
    const nb = b.nx * b.ny * b.nz;
    st.rem[b.t] -= nb;
    st.wLeft -= nb * P.types[b.t].weight;

    let minSide = Infinity;
    for (const t of P.active) {
      if (st.rem[t.index] > 0 && t.weight <= st.wLeft + P.WEPS && t.minSide < minSide) minSide = t.minSide;
    }
    const big = s => s.x1 - s.x0 >= minSide - EPS && s.y1 - s.y0 >= minSide - EPS && s.z1 - s.z0 >= minSide - EPS;

    // Sobre una caja no apilable se reserva toda la columna hasta el techo.
    const X1 = b.x + b.bx, Y1 = P.types[b.t].noStack ? P.H : b.y + b.by, Z1 = b.z + b.bz;
    const keep = [], fresh = [];
    for (const s of st.spaces) {
      if (s.x0 >= X1 - EPS || s.x1 <= b.x + EPS || s.y0 >= Y1 - EPS || s.y1 <= b.y + EPS ||
          s.z0 >= Z1 - EPS || s.z1 <= b.z + EPS) {
        if (big(s)) keep.push(s);
        continue;
      }
      if (b.x - s.x0 > EPS) fresh.push({ x0: s.x0, y0: s.y0, z0: s.z0, x1: b.x, y1: s.y1, z1: s.z1 });
      if (s.x1 - X1 > EPS) fresh.push({ x0: X1, y0: s.y0, z0: s.z0, x1: s.x1, y1: s.y1, z1: s.z1 });
      if (b.y - s.y0 > EPS) fresh.push({ x0: s.x0, y0: s.y0, z0: s.z0, x1: s.x1, y1: b.y, z1: s.z1 });
      if (s.y1 - Y1 > EPS) fresh.push({ x0: s.x0, y0: Y1, z0: s.z0, x1: s.x1, y1: s.y1, z1: s.z1 });
      if (b.z - s.z0 > EPS) fresh.push({ x0: s.x0, y0: s.y0, z0: s.z0, x1: s.x1, y1: s.y1, z1: b.z });
      if (s.z1 - Z1 > EPS) fresh.push({ x0: s.x0, y0: s.y0, z0: Z1, x1: s.x1, y1: s.y1, z1: s.z1 });
    }
    const f2 = fresh.filter(big);
    const out = keep;
    const nKeep = keep.length;
    for (let i = 0; i < f2.length; i++) {
      const f = f2[i];
      let inside = false;
      for (let k = 0; k < nKeep && !inside; k++) if (contains(keep[k], f)) inside = true;
      for (let j = 0; j < f2.length && !inside; j++) {
        if (j !== i && contains(f2[j], f) && (j < i || !contains(f, f2[j]))) inside = true;
      }
      if (!inside) out.push(f);
    }
    st.spaces = out;
  }

  // ---- Candidatos ---------------------------------------------------------

  // Reduce un bloque nx×ny×nz a como mucho q cajas llenando X, luego Z, luego Y.
  function fitShape(nx, ny, nz, q) {
    if (nx * ny * nz <= q) return [nx, ny, nz];
    const layer = nx * nz;
    if (q >= layer) return [nx, Math.floor(q / layer), nz];
    if (q >= nx) return [nx, 1, Math.floor(q / nx)];
    return [q, 1, 1];
  }

  function genCandidates(P, st, s, out) {
    const sx = s.x1 - s.x0, sy = s.y1 - s.y0, sz = s.z1 - s.z0;
    for (const t of P.active) {
      let q = st.rem[t.index];
      if (t.weight > 0 && isFinite(st.wLeft)) q = Math.min(q, Math.floor((st.wLeft + P.WEPS) / t.weight));
      if (q <= 0) continue;
      for (const o of t.oris) {
        const dx = o[0], dy = o[1], dz = o[2];
        if (dx > sx + EPS || dy > sy + EPS || dz > sz + EPS) continue;
        const nx = Math.floor((sx + EPS) / dx), nz = Math.floor((sz + EPS) / dz);
        let ny = t.noStack ? 1 : Math.floor((sy + EPS) / dy);
        if (isFinite(t.maxLoad) && t.weight > 0) ny = Math.min(ny, Math.floor(t.maxLoad / t.weight + 1e-9) + 1);
        const shapes = [
          fitShape(nx, ny, nz, q), fitShape(nx, 1, nz, q), fitShape(nx, 1, 1, q),
          fitShape(1, 1, nz, q), [1, Math.min(ny, q), 1], [1, 1, 1]
        ];
        for (let i = 0; i < shapes.length; i++) {
          const sh = shapes[i];
          let dup = false;
          for (let j = 0; j < i && !dup; j++) {
            const o2 = shapes[j];
            if (o2[0] === sh[0] && o2[1] === sh[1] && o2[2] === sh[2]) dup = true;
          }
          if (dup) continue;
          const bx = sh[0] * dx, by = sh[1] * dy, bz = sh[2] * dz, n = sh[0] * sh[1] * sh[2];
          const r = [sx - bx, sy - by, sz - bz].sort((a, b) => a - b);
          out.push({
            t: t.index, dx, dy, dz, nx: sh[0], ny: sh[1], nz: sh[2], bx, by, bz,
            n, v: n * t.vol, r0: r[0], r1: r[1], r2: r[2],
            // valor por kg (para cuando el peso limita) y densidad (pesadas abajo)
            vpk: t.weight > 0 ? (P.objective === 'count' ? 1 : t.vol) / t.weight : Infinity,
            dens: t.density
          });
        }
      }
    }
  }

  function diff(a, b, tol) { const d = a - b; return Math.abs(d) > tol ? d : 0; }
  const cmpFit = (a, b) => diff(a.r0, b.r0, EPS) || diff(a.r1, b.r1, EPS) || diff(a.r2, b.r2, EPS);
  const COMPARE = {
    vol: (a, b) => diff(b.v, a.v, EPS * EPS) || cmpFit(a, b),
    count: (a, b) => (b.n - a.n) || diff(b.v, a.v, EPS * EPS) || cmpFit(a, b),
    fit: (a, b) => cmpFit(a, b) || diff(b.v, a.v, EPS * EPS),
    // Con límite de peso: primero lo que más aporta por kg.
    perkg: (a, b) => (b.vpk === a.vpk ? 0 : b.vpk > a.vpk ? 1 : -1) || diff(b.v, a.v, EPS * EPS) || cmpFit(a, b),
    // Estabilidad: primero las cajas más densas (quedan abajo).
    heavy: (a, b) => (b.dens - a.dens) || diff(b.v, a.v, EPS * EPS) || cmpFit(a, b)
  };

  function supportArea(st, x, y, z, bx, bz) {
    let area = 0;
    for (const b of st.blocks) {
      if (Math.abs(b.y + b.by - y) > EPS) continue;
      const ox = Math.min(x + bx, b.x + b.bx) - Math.max(x, b.x);
      if (ox <= EPS) continue;
      const oz = Math.min(z + bz, b.z + b.bz) - Math.max(z, b.z);
      if (oz <= EPS) continue;
      area += ox * oz;
    }
    return area;
  }

  // Cada caja de la capa inferior del bloque debe tener el apoyo mínimo.
  function blockSupported(P, st, x, y, z, c) {
    const full = c.bx * c.bz;
    const area = supportArea(st, x, y, z, c.bx, c.bz);
    if (area >= full * (1 - 1e-9)) return true;
    if (area < P.support * full * (1 - 1e-9)) return false;
    const need = P.support * c.dx * c.dz * (1 - 1e-9);
    for (let i = 0; i < c.nx; i++) for (let k = 0; k < c.nz; k++) {
      if (supportArea(st, x + i * c.dx, y, z + k * c.dz, c.dx, c.dz) < need) return false;
    }
    return true;
  }

  // Una caja no apilable no puede tener nada encima (ni ya colocado).
  function columnFree(P, st, x, y, z, c) {
    if (!P.types[c.t].noStack) return true;
    const top = y + c.by;
    for (const b of st.blocks) {
      if (b.y < top - EPS) continue;
      if (Math.min(x + c.bx, b.x + b.bx) - Math.max(x, b.x) > EPS &&
          Math.min(z + c.bz, b.z + b.bz) - Math.max(z, b.z) > EPS) return false;
    }
    return true;
  }

  // center: probar primero la posición del hueco más cercana al centro
  // horizontal del contenedor (reparte el peso de forma equilibrada).
  function findPosition(P, st, s, c, center) {
    const needSupport = P.support > 0 && s.y0 > EPS;
    const noStack = P.types[c.t].noStack;
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const cx = cl(P.W / 2 - c.bx / 2, s.x0, s.x1 - c.bx), cz = cl(P.D / 2 - c.bz / 2, s.z0, s.z1 - c.bz);
    const needLoad = P.hasLoad && s.y0 > EPS && P.types[c.t].weight > 0;
    const loadOk = (x, z) => !needLoad || loadsFit(P, st, loadIncrements(P, st,
      { t: c.t, x, y: s.y0, z, dx: c.dx, dz: c.dz, nx: c.nx, ny: c.ny, nz: c.nz }));
    if (!needSupport && !noStack && !needLoad) return center ? { x: cx, z: cz } : { x: s.x0, z: s.z0 };
    const xs = [s.x0], zs = [s.z0];
    if (s.x1 - c.bx > s.x0 + EPS) xs.push(s.x1 - c.bx);
    if (s.z1 - c.bz > s.z0 + EPS) zs.push(s.z1 - c.bz);
    if (center) { xs.unshift(cx); zs.unshift(cz); }
    for (const x of xs) for (const z of zs) {
      if ((!needSupport || blockSupported(P, st, x, s.y0, z, c)) && columnFree(P, st, x, s.y0, z, c) && loadOk(x, z)) return { x, z };
    }
    return null;
  }

  // ---- Construcción de una solución --------------------------------------

  function construct(P, rng, cfg, prefix) {
    const st = {
      rem: P.types.map(t => t.qty),
      wLeft: P.wCap,
      spaces: [{ x0: 0, y0: 0, z0: 0, x1: P.W, y1: P.H, z1: P.D }],
      blocks: [],
      loads: new Map()
    };
    if (prefix) for (const b of prefix) applyBlock(P, st, b);
    const cands = [];
    const cmp = COMPARE[cfg.crit];
    while (st.spaces.length) {
      const si = selectSpace(st.spaces, cfg.order);
      const s = st.spaces[si];
      cands.length = 0;
      genCandidates(P, st, s, cands);
      let chosen = null;
      if (cands.length) {
        cands.sort(cmp);
        while (cands.length) {
          let idx = 0;
          if (cfg.k > 1 && rng() < cfg.p) idx = Math.floor(rng() * Math.min(cfg.k, cands.length));
          const c = cands[idx];
          const pos = findPosition(P, st, s, c, cfg.center);
          if (pos) {
            chosen = {
              t: c.t, x: pos.x, y: s.y0, z: pos.z, dx: c.dx, dy: c.dy, dz: c.dz,
              nx: c.nx, ny: c.ny, nz: c.nz, bx: c.bx, by: c.by, bz: c.bz
            };
            break;
          }
          cands.splice(idx, 1);
        }
      }
      if (!chosen) { st.spaces.splice(si, 1); continue; }
      applyBlock(P, st, chosen);
    }
    return st;
  }

  function evaluate(P, blocks) {
    let n = 0, v = 0, top = 0, w = 0, mx = 0, my = 0, mz = 0;
    for (const b of blocks) {
      const k = b.nx * b.ny * b.nz, bw = k * P.types[b.t].weight;
      n += k; v += k * P.types[b.t].vol; w += bw;
      mx += bw * (b.x + b.bx / 2); my += bw * (b.y + b.by / 2); mz += bw * (b.z + b.bz / 2);
      if (b.y + b.by > top) top = b.y + b.by;
    }
    const cog = w > 0 ? { x: mx / w, y: my / w, z: mz / w } : null;
    // Desplazamiento horizontal del centro de gravedad respecto al centro del contenedor.
    const off = cog ? Math.hypot(cog.x - P.W / 2, cog.z - P.D / 2) : 0;
    return { n, v, top, w, cog, off };
  }

  function isBetter(P, a, b) {
    if (!b) return true;
    const tolV = P.V * 1e-9;
    if (P.objective === 'count') {
      if (a.n !== b.n) return a.n > b.n;
      if (Math.abs(a.v - b.v) > tolV) return a.v > b.v;
    } else {
      if (Math.abs(a.v - b.v) > tolV) return a.v > b.v;
      if (a.n !== b.n) return a.n > b.n;
    }
    if (P.hasWeight && a.cog && b.cog) {
      // Más estable: centro de gravedad más bajo y luego más centrado.
      const ty = P.H * 0.005, tx = Math.max(P.W, P.D) * 0.005;
      if (Math.abs(a.cog.y - b.cog.y) > ty) return a.cog.y < b.cog.y;
      if (Math.abs(a.off - b.off) > tx) return a.off < b.off;
    }
    return a.top < b.top - EPS;
  }

  // ---- Programación dinámica guillotina (modo maximizar) -----------------
  //
  // Óptimo entre los empaquetados "guillotina" (el contenedor se puede cortar
  // recursivamente con planos paralelos a las caras) suponiendo cantidades
  // ilimitadas. Los tamaños de subcontenedor se restringen a "puntos raster"
  // (sumas de dimensiones de cajas), lo que mantiene el problema pequeño.

  function rasterPoints(L, dims, limit) {
    const pts = [0];
    const seen = new Set([0]);
    const key = v => Math.round(v / (EPS * 10));
    for (let i = 0; i < pts.length; i++) {
      for (const d of dims) {
        const v = pts[i] + d;
        if (v > L + EPS) continue;
        const k = key(v);
        if (seen.has(k)) continue;
        seen.add(k); pts.push(v);
        if (pts.length > limit) return null;
      }
    }
    return pts.sort((a, b) => a - b).slice(1);
  }

  function guillotineDP(P, maxStates) {
    const items = [];
    for (const t of P.active) for (const o of t.oris) items.push({ t: t.index, dx: o[0], dy: o[1], dz: o[2], vol: t.vol });
    if (!items.length) return null;
    const uniq = a => Array.from(new Set(a));
    const Rx = rasterPoints(P.W, uniq(items.map(i => i.dx)), 400);
    const Ry = rasterPoints(P.H, uniq(items.map(i => i.dy)), 400);
    const Rz = rasterPoints(P.D, uniq(items.map(i => i.dz)), 400);
    if (!Rx || !Ry || !Rz || !Rx.length || !Ry.length || !Rz.length) return null;
    const nx = Rx.length, ny = Ry.length, nz = Rz.length, N = nx * ny * nz;
    if (N > maxStates || N * (nx + ny + nz) / 2 > 150e6) return null;

    // idx[i][a] = índice del mayor raster <= R[i] - R[a] (o -1).
    const restTable = R => R.map(v => R.map(c => {
      const rest = v - c;
      let lo = 0, hi = R.length - 1, ans = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (R[m] <= rest + EPS) { ans = m; lo = m + 1; } else hi = m - 1; }
      return ans;
    }));
    const TX = restTable(Rx), TY = restTable(Ry), TZ = restTable(Rz);

    const byCount = P.objective === 'count';
    const v1 = new Float64Array(N), v2 = new Float64Array(N);
    const chK = new Int8Array(N), chA = new Int32Array(N);
    const tol = P.V * 1e-9;
    const id = (i, j, k) => (i * ny + j) * nz + k;

    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      const X = Rx[i], Y = Ry[j], Z = Rz[k];
      let b1 = 0, b2 = 0, bk = 0, ba = 0;
      const consider = (a1, a2, kind, arg) => {
        const d = byCount ? a1 - b1 : (Math.abs(a1 - b1) > tol ? a1 - b1 : 0);
        if (d > 0 || (d === 0 && (byCount ? a2 - b2 > tol : a2 > b2))) { b1 = a1; b2 = a2; bk = kind; ba = arg; }
      };
      for (let q = 0; q < items.length; q++) {
        const it = items[q];
        if (it.dx <= X + EPS && it.dy <= Y + EPS && it.dz <= Z + EPS) {
          if (byCount) consider(1, it.vol, 1, q); else consider(it.vol, 1, 1, q);
        }
      }
      for (let a = 0; a < i && Rx[a] <= X / 2 + EPS; a++) {
        const r = TX[i][a], s1 = id(a, j, k);
        const s2 = r >= 0 ? id(r, j, k) : -1;
        consider(v1[s1] + (s2 >= 0 ? v1[s2] : 0), v2[s1] + (s2 >= 0 ? v2[s2] : 0), 2, a);
      }
      for (let a = 0; a < j && Ry[a] <= Y / 2 + EPS; a++) {
        const r = TY[j][a], s1 = id(i, a, k);
        const s2 = r >= 0 ? id(i, r, k) : -1;
        consider(v1[s1] + (s2 >= 0 ? v1[s2] : 0), v2[s1] + (s2 >= 0 ? v2[s2] : 0), 3, a);
      }
      for (let a = 0; a < k && Rz[a] <= Z / 2 + EPS; a++) {
        const r = TZ[k][a], s1 = id(i, j, a);
        const s2 = r >= 0 ? id(i, j, r) : -1;
        consider(v1[s1] + (s2 >= 0 ? v1[s2] : 0), v2[s1] + (s2 >= 0 ? v2[s2] : 0), 4, a);
      }
      const s = id(i, j, k);
      v1[s] = b1; v2[s] = b2; chK[s] = bk; chA[s] = ba;
    }

    // Reconstrucción.
    const boxes = [];
    const stack = [[nx - 1, ny - 1, nz - 1, 0, 0, 0]];
    while (stack.length) {
      const [i, j, k, ox, oy, oz] = stack.pop();
      const s = id(i, j, k), kind = chK[s], a = chA[s];
      if (kind === 1) {
        const it = items[a];
        boxes.push({ t: it.t, x: ox, y: oy, z: oz, dx: it.dx, dy: it.dy, dz: it.dz });
      } else if (kind === 2) {
        stack.push([a, j, k, ox, oy, oz]);
        if (TX[i][a] >= 0) stack.push([TX[i][a], j, k, ox + Rx[a], oy, oz]);
      } else if (kind === 3) {
        stack.push([i, a, k, ox, oy, oz]);
        if (TY[j][a] >= 0) stack.push([i, TY[j][a], k, ox, oy + Ry[a], oz]);
      } else if (kind === 4) {
        stack.push([i, j, a, ox, oy, oz]);
        if (TZ[k][a] >= 0) stack.push([i, j, TZ[k][a], ox, oy, oz + Rz[a]]);
      }
    }
    return boxes;
  }

  // Deja caer las cajas (gravedad), respeta cantidades máximas y elimina las
  // que no tengan el apoyo mínimo exigido. Devuelve bloques 1×1×1.
  function settle(P, boxes) {
    boxes = boxes.slice().sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
    const left = P.types.map(t => t.qty);
    let wLeft = P.wCap;
    const placed = [];
    const lst = { blocks: [], loads: new Map() };   // para comprobar la carga soportada

    // Rejilla en el plano XZ para no comparar cada caja con todas.
    let minSide = Infinity;
    for (const b of boxes) minSide = Math.min(minSide, b.dx, b.dz);
    const cs = Math.max(minSide, Math.max(P.W, P.D) / 128);
    const gw = Math.max(1, Math.ceil(P.W / cs)), gd = Math.max(1, Math.ceil(P.D / cs));
    const grid = new Array(gw * gd);
    const cellRange = b => [
      Math.max(0, Math.floor((b.x + EPS) / cs)), Math.min(gw - 1, Math.floor((b.x + b.dx - EPS) / cs)),
      Math.max(0, Math.floor((b.z + EPS) / cs)), Math.min(gd - 1, Math.floor((b.z + b.dz - EPS) / cs))
    ];
    let stamp = 0;
    const neighbours = b => {
      const [i0, i1, k0, k1] = cellRange(b), out = [];
      stamp++;
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
        const cell = grid[i * gd + k];
        if (!cell) continue;
        for (const p of cell) {
          if (p.seen === stamp) continue;
          p.seen = stamp;
          if (Math.min(b.x + b.dx, p.x + p.dx) - Math.max(b.x, p.x) > EPS &&
              Math.min(b.z + b.dz, p.z + p.dz) - Math.max(b.z, p.z) > EPS) out.push(p);
        }
      }
      return out;
    };

    for (const b of boxes) {
      if (left[b.t] <= 0 || P.types[b.t].weight > wLeft + P.WEPS) continue;
      const near = neighbours(b);
      if (near.some(p => P.types[p.t].noStack)) continue;
      let y = 0;
      for (const p of near) {
        const top = p.y + p.dy;
        if (top > y && top <= b.y + EPS) y = top;
      }
      if (y > EPS && P.support > 0) {
        let area = 0;
        for (const p of near) {
          if (Math.abs(p.y + p.dy - y) > EPS) continue;
          area += (Math.min(b.x + b.dx, p.x + p.dx) - Math.max(b.x, p.x)) *
                  (Math.min(b.z + b.dz, p.z + p.dz) - Math.max(b.z, p.z));
        }
        if (area < P.support * b.dx * b.dz * (1 - 1e-9)) continue;
      }
      let lblk = null;
      if (P.hasLoad) {
        lblk = { t: b.t, x: b.x, y, z: b.z, dx: b.dx, dy: b.dy, dz: b.dz, nx: 1, ny: 1, nz: 1, bx: b.dx, by: b.dy, bz: b.dz };
        const inc = loadIncrements(P, lst, lblk);
        if (!loadsFit(P, lst, inc)) continue;
        commitLoads(lst, inc);
        lst.blocks.push(lblk);
      }
      left[b.t]--;
      wLeft -= P.types[b.t].weight;
      const q = { t: b.t, x: b.x, y, z: b.z, dx: b.dx, dy: b.dy, dz: b.dz, seen: 0 };
      placed.push(q);
      const [i0, i1, k0, k1] = cellRange(q);
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) (grid[i * gd + k] || (grid[i * gd + k] = [])).push(q);
    }
    return placed.map(b => ({
      t: b.t, x: b.x, y: b.y, z: b.z, dx: b.dx, dy: b.dy, dz: b.dz,
      nx: 1, ny: 1, nz: 1, bx: b.dx, by: b.dy, bz: b.dz
    }));
  }

  // ---- Solver -------------------------------------------------------------

  const CRITS = ['vol', 'count', 'fit'];

  class Solver {
    constructor(input, seed) {
      this.input = input;
      this.P = prepare(input);
      this.rng = mulberry32(seed == null ? 20240917 : seed);
      this.iter = 0;
      this.best = null;
      this.bestScore = null;
      this.elapsed = 0;
      this.plan = [];
      const P = this.P;
      this.crits = CRITS.slice();
      if (isFinite(P.wCap)) this.crits.push('perkg');
      if (P.hasWeight) this.crits.push('heavy');
      const first = (P.objective === 'count' ? ['count', 'fit', 'vol'] : ['vol', 'fit', 'count']).concat(this.crits.slice(3));
      for (const crit of first) for (const order of [0, 1]) this.plan.push({ crit, order, k: 1, p: 0 });
      if (P.hasWeight) for (const crit of first) this.plan.push({ crit, order: 0, k: 1, p: 0, center: true });
      this.done = this.P.active.length === 0;
    }

    boundReached() {
      if (!this.bestScore) return false;
      const P = this.P;
      if (this.bestScore.v >= P.volBound - P.V * 1e-9) {
        // En modo fijo, si caben todas, se sigue buscando una colocación más baja
        // (o, si hay pesos, más estable) durante el tiempo disponible.
        return P.mode !== 'fixed' || (!P.hasWeight && this.bestScore.top <= P.minTop + EPS);
      }
      return P.objective === 'count' && this.bestScore.n >= P.countBound;
    }

    iterate() {
      const P = this.P, rng = this.rng;
      let cfg, prefix = null;
      if (this.iter < this.plan.length) cfg = this.plan[this.iter];
      else {
        cfg = {
          crit: this.crits[Math.floor(rng() * this.crits.length)],
          order: rng() < 0.5 ? 0 : 1,
          k: 2 + Math.floor(rng() * 3),
          p: 0.05 + rng() * 0.4,
          center: P.hasWeight && rng() < 0.35
        };
        const bb = this.best && this.best.blocks;
        if (bb && bb.length > 1 && bb.length <= 3000 && rng() < 0.5) {
          prefix = bb.slice(0, Math.floor(bb.length * (0.2 + 0.75 * rng())));
        }
      }
      const st = construct(P, rng, cfg, prefix);
      const sc = evaluate(P, st.blocks);
      if (isBetter(P, sc, this.bestScore)) { this.best = st; this.bestScore = sc; }
      this.iter++;
    }

    runDP() {
      const P = this.P;
      if (P.mode !== 'max') return;
      const boxes = guillotineDP(P, 1200000);
      if (!boxes || (P.hasLoad && boxes.length > 4000)) return;
      const blocks = settle(P, boxes);
      const sc = evaluate(P, blocks);
      if (isBetter(P, sc, this.bestScore)) { this.best = { blocks }; this.bestScore = sc; }
      this.usedDP = true;
    }

    // Ejecuta iteraciones durante ~ms milisegundos.
    run(ms) {
      if (this.done) return;
      const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const t0 = now();
      if (!this.dpTried) {
        this.dpTried = true;
        this.runDP();
        if (this.boundReached()) { this.done = true; this.elapsed += now() - t0; return; }
      }
      do {
        this.iterate();
        if (this.boundReached()) { this.done = true; break; }
      } while (now() - t0 < ms);
      this.elapsed += now() - t0;
    }

    result(maxItems) {
      maxItems = maxItems || 60000;
      const P = this.P;
      const blocks = this.best ? this.best.blocks : [];
      let sc = this.bestScore || { n: 0, v: 0, top: 0, w: 0, cog: null, off: 0 };
      const grouped = sc.n > maxItems;

      // Con pesos, se desplaza toda la carga (movimiento rígido, dentro del hueco
      // libre) para acercar el centro de gravedad al centro: más fácil de cargar.
      let sx = 0, sz = 0;
      if (P.hasWeight && sc.cog && blocks.length) {
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const b of blocks) {
          x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.bx);
          z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z + b.bz);
        }
        sx = Math.max(-x0, Math.min(P.W - x1, P.W / 2 - sc.cog.x));
        sz = Math.max(-z0, Math.min(P.D - z1, P.D / 2 - sc.cog.z));
        if (sx || sz) sc = evaluate(P, blocks.map(b => Object.assign({}, b, { x: b.x + sx, z: b.z + sz })));
      }
      // Carga que soporta cada caja (kg encima), reproduciendo la colocación.
      let loads = null;
      if (P.hasWeight && !grouped && blocks.length <= 5000) {
        const lst = { blocks: [], loads: new Map() };
        for (const b of blocks) { commitLoads(lst, loadIncrements(P, lst, b)); lst.blocks.push(b); }
        loads = lst.loads;
      }
      const items = [];
      const placed = P.types.map(() => 0);
      for (const b of blocks) {
        const k = b.nx * b.ny * b.nz;
        placed[b.t] += k;
        const colLoads = loads && loads.get(b), w = P.types[b.t].weight;
        if (grouped) {
          items.push({ t: b.t, x: b.x + sx, y: b.y, z: b.z + sz, w: b.bx, h: b.by, d: b.bz, count: k });
          continue;
        }
        for (let j = 0; j < b.ny; j++)
          for (let kz = 0; kz < b.nz; kz++)
            for (let i = 0; i < b.nx; i++)
              items.push({
                t: b.t, x: b.x + sx + i * b.dx, y: b.y + j * b.dy, z: b.z + sz + kz * b.dz, w: b.dx, h: b.dy, d: b.dz, count: 1,
                load: loads ? (colLoads ? colLoads[i * b.nz + kz] : 0) + (b.ny - 1 - j) * w : undefined
              });
      }
      return {
        items, grouped,
        count: sc.n, volume: sc.v, utilization: P.V > 0 ? sc.v / P.V : 0, top: sc.top,
        placed,
        requested: P.types.map(t => t.qty),
        fits: P.types.map(t => t.fits),
        containerVolume: P.V,
        weight: sc.w, cog: sc.cog, cogOffset: sc.off,
        maxWeight: isFinite(P.maxWeight) ? P.maxWeight : null, tare: P.tare,
        tooHeavy: P.types.map(t => !!t.tooHeavy),
        maxLoads: P.types.map(t => (isFinite(t.maxLoad) ? t.maxLoad : null)),
        countBound: P.countBound, volBound: P.volBound,
        boundReached: this.boundReached(),
        iterations: this.iter, elapsed: this.elapsed, usedDP: !!this.usedDP
      };
    }
  }

  // ---- Varios contenedores ------------------------------------------------
  //
  // Llena contenedores iguales uno tras otro con lo que queda por colocar.
  //   bins.auto = true (solo en modo fijo): tantos contenedores como hagan falta.
  //   bins.n: número fijo de contenedores.
  // Si la distribución de un contenedor sigue siendo válida con lo que queda,
  // se reutiliza sin recalcular (contenedores idénticos).

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  class MultiSolver {
    constructor(input, budgetMs, maxItems) {
      this.input = input;
      this.maxItems = maxItems || 60000;
      const P = this.P = prepare(input);
      const b = input.bins || {};
      this.auto = P.mode === 'fixed' && !!b.auto;
      this.target = this.auto ? 500 : Math.max(1, Math.floor(+b.n || 1));
      this.rem = P.types.map(t => (t.fits && !t.tooHeavy ? t.qty : 0));
      this.bins = [];
      this.cur = null;
      this.curSpent = 0;
      this.elapsed = 0;
      this.iters = 0;
      this.done = !this._pending();

      // Mínimo teórico de contenedores (por volumen y por peso).
      let tv = 0, tw = 0;
      for (const t of P.types) if (isFinite(this.rem[t.index])) { tv += this.rem[t.index] * t.vol; tw += this.rem[t.index] * t.weight; }
      this.lowerBound = Math.max(1, Math.ceil(tv / P.V - 1e-9), isFinite(P.wCap) && P.wCap > 0 ? Math.ceil(tw / P.wCap - 1e-9) : 0);

      const unlimited = this.rem.some(q => q === Infinity);
      const est = this.auto ? this.lowerBound : unlimited ? 1 : Math.min(this.target, this.lowerBound);
      this.perBin = Math.max(250, (budgetMs || 3000) / Math.max(1, est));
    }

    _pending() { return this.rem.some(q => q > 0); }

    // Acelera los contenedores que faltan (al pulsar "Detener").
    hurry() { this.perBin = Math.min(this.perBin, 40); }

    _resolve(k) { const b = this.bins[k]; return b && b.sameAs != null ? this.bins[b.sameAs] : b; }

    _startNext() {
      if (this.bins.length >= this.target || !this._pending()) { this.done = true; return; }
      const k = this.bins.length - 1;
      if (k >= 0) {
        const src = this.bins[k].sameAs != null ? this.bins[k].sameAs : k;
        const last = this.bins[src];
        if (last.placed.every((c, i) => c <= this.rem[i])) {
          this.bins.push({ sameAs: src });
          last.placed.forEach((c, i) => { this.rem[i] -= c; });
          return;
        }
      }
      const types = this.input.types.map((t, i) => Object.assign({}, t, { qty: this.rem[i] === Infinity ? null : this.rem[i] }));
      // Para averiguar cuántos contenedores hacen falta conviene llenar cada uno por volumen.
      const objective = this.auto ? 'volume' : this.input.objective;
      this.cur = new Solver(Object.assign({}, this.input, { types, objective }), 20240917 + this.bins.length);
      this.curSpent = 0;
    }

    _finishCurrent() {
      const r = this.cur.result(this.maxItems);
      this.iters += this.cur.iter;
      this.cur = null;
      if (r.count === 0) { this.done = true; return; }   // ya no cabe nada más
      this.bins.push({
        items: r.items, grouped: r.grouped, count: r.count, volume: r.volume, utilization: r.utilization,
        top: r.top, placed: r.placed, weight: r.weight, cog: r.cog, cogOffset: r.cogOffset,
        boundReached: r.boundReached, countBound: r.countBound, usedDP: r.usedDP
      });
      r.placed.forEach((c, i) => { this.rem[i] -= c; });
    }

    run(ms) {
      const t0 = now();
      while (!this.done && now() - t0 < ms) {
        if (!this.cur) { this._startNext(); continue; }
        const slice = Math.min(ms - (now() - t0), this.perBin - this.curSpent);
        if (slice > 0 && !this.cur.done) {
          const a = now();
          this.cur.run(Math.max(1, slice));
          this.curSpent += now() - a;
        }
        if (this.cur.done || this.curSpent >= this.perBin) this._finishCurrent();
      }
      this.elapsed += now() - t0;
    }

    // Progreso: cajas colocadas hasta ahora y contenedor en curso.
    progress() {
      let n = 0, v = 0;
      for (let k = 0; k < this.bins.length; k++) { const b = this._resolve(k); n += b.count; v += b.volume; }
      const sc = this.cur && this.cur.bestScore;
      return { count: n + (sc ? sc.n : 0), volume: v + (sc ? sc.v : 0), bin: this.bins.length + (this.cur ? 1 : 0), iterations: this.iters + (this.cur ? this.cur.iter : 0) };
    }

    result() {
      const P = this.P;
      const placed = P.types.map(() => 0);
      let count = 0, volume = 0, weight = 0;
      for (let k = 0; k < this.bins.length; k++) {
        const b = this._resolve(k);
        b.placed.forEach((c, i) => { placed[i] += c; });
        count += b.count; volume += b.volume; weight += b.weight;
      }
      const n = this.bins.length;
      return {
        multi: true,
        bins: this.bins,
        nBins: n, auto: this.auto, target: this.auto ? null : this.target,
        lowerBound: this.lowerBound,
        count, volume, weight, placed,
        utilization: n ? volume / (n * P.V) : 0,
        requested: P.types.map(t => t.qty),
        leftover: this.rem.map(q => (isFinite(q) ? q : null)),
        complete: !this._pending(),
        fits: P.types.map(t => t.fits),
        tooHeavy: P.types.map(t => !!t.tooHeavy),
        maxLoads: P.types.map(t => (isFinite(t.maxLoad) ? t.maxLoad : null)),
        containerVolume: P.V,
        maxWeight: isFinite(P.maxWeight) ? P.maxWeight : null, tare: P.tare,
        iterations: this.iters, elapsed: this.elapsed
      };
    }
  }

  return { Solver, MultiSolver, orientationsFor, prepare };
}

if (typeof module !== 'undefined' && module.exports) module.exports = OrganizadorPacker();
else if (typeof window !== 'undefined') window.Packer = OrganizadorPacker();
