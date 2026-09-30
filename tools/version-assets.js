#!/usr/bin/env node
/*
 * Añade a index.html una huella (?v=...) en cada CSS y JS según su contenido,
 * para que el navegador no use versiones antiguas guardadas en caché tras
 * publicar cambios. Ejecutar antes de cada commit que se vaya a publicar:
 *
 *   node tools/version-assets.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
let changed = 0;

html = html.replace(/(<(?:script[^>]*\ssrc|link[^>]*\shref)=")((?:js|css)\/[^"?]+)(?:\?v=[0-9a-f]+)?(")/g, (m, pre, file, post) => {
  const data = fs.readFileSync(path.join(root, file));
  const v = crypto.createHash('sha1').update(data).digest('hex').slice(0, 8);
  changed++;
  return `${pre}${file}?v=${v}${post}`;
});

fs.writeFileSync(htmlPath, html);
console.log(`index.html: ${changed} archivos versionados.`);
