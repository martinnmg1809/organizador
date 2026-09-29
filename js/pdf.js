/*
 * Organizador de espacios — generador mínimo de PDF (sin dependencias).
 *
 * Admite rectángulos, líneas, texto con Helvetica (codificación WinAnsi, que
 * incluye acentos, ñ, ×, ·, ², ³…), transparencia e imágenes JPEG. Las medidas
 * se dan en puntos con origen arriba a la izquierda, como en Canvas.
 */
(function (root) {
  'use strict';

  const WIN_EXTRA = {
    '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
    'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
    '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F
  };

  // Texto → literal PDF (solo ASCII, el resto con escapes octales).
  function pdfString(str) {
    let out = '(';
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      let b = (c >= 32 && c < 127) || (c >= 160 && c <= 255) ? c : (WIN_EXTRA[ch] || 63);
      if (b === 40 || b === 41 || b === 92) out += '\\' + String.fromCharCode(b);
      else if (b > 126) out += '\\' + b.toString(8).padStart(3, '0');
      else out += String.fromCharCode(b);
    }
    return out + ')';
  }

  // Cadena de texto para metadatos (UTF-16BE con BOM).
  function pdfTextString(str) {
    let hex = 'FEFF';
    for (let i = 0; i < str.length; i++) hex += str.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
    return '<' + hex + '>';
  }

  function parseColor(c) {
    if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] == null ? 1 : c[3]];
    c = String(c || '#000').trim();
    let m;
    if (c[0] === '#') {
      let h = c.slice(1);
      if (h.length === 3) h = h.split('').map(x => x + x).join('');
      const n = parseInt(h.slice(0, 6), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    if ((m = c.match(/rgba?\(([^)]+)\)/i))) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] == null ? 1 : p[3]];
    }
    return [0, 0, 0, 1];
  }

  const n2 = v => (Math.round(v * 100) / 100).toString();

  class MiniPdf {
    constructor() {
      this.pages = [];
      this.images = [];
      this.alphas = [];
    }

    addPage(w, h) {
      const page = { w, h, ops: [] };
      this.pages.push(page);
      return page;
    }

    addJpeg(dataUrl, w, h) {
      const bin = atob(dataUrl.split(',')[1]);
      this.images.push({ bin, w, h });
      return this.images.length - 1;
    }

    gsName(alpha) {
      const a = Math.round(Math.max(0, Math.min(1, alpha)) * 100) / 100;
      let i = this.alphas.indexOf(a);
      if (i < 0) { this.alphas.push(a); i = this.alphas.length - 1; }
      return '/GS' + i;
    }

    async _deflate(str) {
      if (typeof CompressionStream === 'undefined') return null;
      try {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
        const cs = new CompressionStream('deflate');
        const buf = await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
        const u8 = new Uint8Array(buf);
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return s;
      } catch (e) { return null; }
    }

    async toBlob(meta) {
      meta = meta || {};
      const objs = [];                 // cuerpo de cada objeto (índice + 1 = número)
      const reserve = () => { objs.push(null); return objs.length; };
      const set = (n, body) => { objs[n - 1] = body; };

      const catalog = reserve(), pagesObj = reserve(), info = reserve();
      const f1 = reserve(), f2 = reserve();
      set(f1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      set(f2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const gsObjs = this.alphas.map(a => { const n = reserve(); set(n, `<< /Type /ExtGState /ca ${a} /CA ${a} >>`); return n; });
      const imgObjs = this.images.map(im => {
        const n = reserve();
        set(n, `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bin.length} >>\nstream\n${im.bin}\nendstream`);
        return n;
      });
      const res = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>` +
        (gsObjs.length ? ` /ExtGState << ${gsObjs.map((n, i) => `/GS${i} ${n} 0 R`).join(' ')} >>` : '') +
        (imgObjs.length ? ` /XObject << ${imgObjs.map((n, i) => `/Im${i} ${n} 0 R`).join(' ')} >>` : '') + ' >>';

      const kids = [];
      for (const pg of this.pages) {
        const content = pg.ops.join('\n');
        const z = await this._deflate(content);
        const cN = reserve();
        set(cN, z != null
          ? `<< /Length ${z.length} /Filter /FlateDecode >>\nstream\n${z}\nendstream`
          : `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        const pN = reserve();
        set(pN, `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${n2(pg.w)} ${n2(pg.h)}] /Resources ${res} /Contents ${cN} 0 R >>`);
        kids.push(pN);
      }
      set(catalog, `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
      set(pagesObj, `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`);
      set(info, `<< /Title ${pdfTextString(meta.title || 'Documento')} /Producer ${pdfTextString('Organizador de espacios')} >>`);

      let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
      const offsets = [];
      objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
      for (const o of offsets) out += String(o).padStart(10, '0') + ' 00000 n \n';
      out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
      return new Blob([bytes], { type: 'application/pdf' });
    }
  }

  // ---- Pintor PDF (misma interfaz que CanvasPainter) --------------------------
  const measureCtx = document.createElement('canvas').getContext('2d');

  class PdfPainter {
    constructor(pdf, page) { this.pdf = pdf; this.page = page; this.H = page.h; }
    _op(s) { this.page.ops.push(s); }
    _fill(c) { const [r, g, b, a] = parseColor(c); return { cmd: `${n2(r)} ${n2(g)} ${n2(b)} rg`, a }; }
    _stroke(c) { const [r, g, b, a] = parseColor(c); return { cmd: `${n2(r)} ${n2(g)} ${n2(b)} RG`, a }; }

    fillRect(x, y, w, h, color, alpha) {
      const f = this._fill(color), a = f.a * (alpha == null ? 1 : alpha);
      this._op(`q ${a < 1 ? this.pdf.gsName(a) + ' gs ' : ''}${f.cmd} ${n2(x)} ${n2(this.H - y - h)} ${n2(w)} ${n2(h)} re f Q`);
    }
    strokeRect(x, y, w, h, color, lw) {
      const s = this._stroke(color);
      this._op(`q ${s.a < 1 ? this.pdf.gsName(s.a) + ' gs ' : ''}${s.cmd} ${n2(lw || 1)} w ${n2(x)} ${n2(this.H - y - h)} ${n2(w)} ${n2(h)} re S Q`);
    }
    lines(segs, color, lw) {
      if (!segs.length) return;
      const s = this._stroke(color);
      const path = segs.map(q => `${n2(q[0])} ${n2(this.H - q[1])} m ${n2(q[2])} ${n2(this.H - q[3])} l`).join(' ');
      this._op(`q ${s.a < 1 ? this.pdf.gsName(s.a) + ' gs ' : ''}${s.cmd} ${n2(lw || 1)} w 0 J ${path} S Q`);
    }
    hatch(x, y, w, h, color, spacing, lw) {
      const segs = [];
      for (let k = -h; k < w; k += spacing) segs.push([x + k, y + h, x + k + h, y]);
      this._op(`q ${n2(x)} ${n2(this.H - y - h)} ${n2(w)} ${n2(h)} re W n`);
      this.lines(segs, color, lw);
      this._op('Q');
    }
    image(id, x, y, w, h) {
      this._op(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(this.H - y - h)} cm /Im${id} Do Q`);
    }
    measure(str, size, bold) {
      measureCtx.font = `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`;
      return measureCtx.measureText(str).width;
    }
    text(str, x, y, opt) {
      const size = opt.size || 11, w = this.measure(str, size, opt.bold);
      const dx = opt.align === 'center' ? -w / 2 : opt.align === 'right' ? -w : 0;
      const b = opt.baseline;
      const dy = b === 'top' ? size * 0.76 : b === 'middle' ? size * 0.36 : b === 'bottom' ? -size * 0.22 : 0;
      const t = opt.rotate || 0, c = Math.cos(t), s = Math.sin(t);
      const wx = x + c * dx - s * dy, wy = y + s * dx + c * dy;
      const f = this._fill(opt.color || '#000');
      // En PDF el eje Y va hacia arriba: el giro cambia de signo.
      const pc = Math.cos(-t), ps = Math.sin(-t);
      this._op(`q ${f.a < 1 ? this.pdf.gsName(f.a) + ' gs ' : ''}${f.cmd} BT /${opt.bold ? 'F2' : 'F1'} ${n2(size)} Tf ` +
        `${n2(pc)} ${n2(ps)} ${n2(-ps)} ${n2(pc)} ${n2(wx)} ${n2(this.H - wy)} Tm ${pdfString(str)} Tj ET Q`);
    }
  }

  root.MiniPdf = MiniPdf;
  root.PdfPainter = PdfPainter;
})(window);
