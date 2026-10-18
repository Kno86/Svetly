// Generates the SVETLY logo set from one geometry source.
// Wordmark glyphs are converted to outlines from Manrope ExtraBold (SIL OFL 1.1), so no font is needed to render it.
// Usage: pnpm --filter @svetly/web run brand:generate
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, '..');
const out = (...p) => join(root, ...p);

function fmt(n) {
  return Number(n.toFixed(2));
}

const C = {
  deep: '#103C2F',
  forest: '#245844',
  leaf: '#7D9D58',
  gold: '#E9BC66',
  ivory: '#F7F6F0',
  forestDark: '#1B4A39',
};

// --- Mark geometry (64 x 64 grid) ---------------------------------------------------------------
const M = {
  size: 64,
  radius: 16,
  sun: { cx: 41.5, cy: 21, r: 8 },
  hill: 'M0 41C10 35.5 21 33.6 32 35.6C43 37.6 53 37.2 64 33.5V64H0Z',
  trees: 'M12.5 22.5L18.6 35.4H6.4ZM20.4 26.5L25 36.2H15.8Z',
  house: 'M27.2 31.6L32 27.4L36.8 31.6V37.4H27.2Z',
  road: 'M19.5 64C25.5 55.2 33.6 51.1 39.6 46.6C43.4 43.7 44.2 40.8 41.3 38.6C42.2 41.6 40.3 43.6 36.4 45.6C29.4 49.2 19.8 53.4 11 64Z',
};

function markFull(prefix = 'm', onDark = false) {
  const clip = `${prefix}-clip`;
  return `<defs><clipPath id="${clip}"><rect width="64" height="64" rx="${M.radius}"/></clipPath></defs>
<g clip-path="url(#${clip})">
<rect width="64" height="64" fill="${onDark ? C.forest : C.deep}"/>
<circle cx="${M.sun.cx}" cy="${M.sun.cy}" r="${M.sun.r}" fill="${C.gold}"/>
<path d="${M.hill}" fill="${onDark ? C.forestDark : C.forest}"/>
<path d="${M.trees}" fill="${C.leaf}"/>
<path d="${M.house}" fill="${C.ivory}"/>
<path d="${M.road}" fill="${C.ivory}"/>
</g>`;
}

// Small sizes (favicon 16-48 px): house and trees are dropped so the sun and road stay legible.
function markSmall(prefix = 's') {
  const clip = `${prefix}-clip`;
  return `<defs><clipPath id="${clip}"><rect width="64" height="64" rx="${M.radius}"/></clipPath></defs>
<g clip-path="url(#${clip})">
<rect width="64" height="64" fill="${C.deep}"/>
<circle cx="${M.sun.cx}" cy="${M.sun.cy}" r="${M.sun.r + 2}" fill="${C.gold}"/>
<path d="${M.hill}" fill="${C.forest}"/>
<path d="${M.road}" fill="${C.ivory}" transform="translate(32 64) scale(1.25) translate(-32 -64)"/>
</g>`;
}

// Single colour: the badge is solid and the symbol elements are knocked out (transparent).
function markMono(color, prefix = 'm') {
  const mask = `${prefix}-mask`;
  return `<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
<rect width="64" height="64" rx="${M.radius}" fill="#fff"/>
<circle cx="${M.sun.cx}" cy="${M.sun.cy}" r="${M.sun.r}" fill="#000"/>
<path d="${M.trees}" fill="#000"/>
<path d="${M.house}" fill="#000"/>
<path d="${M.road}" fill="#000"/>
</mask></defs>
<rect width="64" height="64" rx="${M.radius}" fill="${color}" mask="url(#${mask})"/>`;
}

// --- Wordmark ------------------------------------------------------------------------------------
const fontFile = require.resolve('@fontsource/manrope/files/manrope-latin-800-normal.woff');
const fontBuf = await readFile(fontFile);
const font = opentype.parse(
  fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength),
);

// Converts glyph outlines (font units, y up) to SVG path data (y down, baseline at 0).
function glyphPathData(glyph, originX, scale) {
  const X = (v) => fmt(originX + v * scale);
  const Y = (v) => fmt(-v * scale);
  return glyph.path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
          return `M${X(c.x)} ${Y(c.y)}`;
        case 'L':
          return `L${X(c.x)} ${Y(c.y)}`;
        case 'Q':
          return `Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`;
        case 'C':
          return `C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`;
        case 'Z':
          return 'Z';
        default:
          throw new Error(`Unsupported path command ${c.type}`);
      }
    })
    .join('');
}

function wordmark(text, fontSize, tracking) {
  const scale = fontSize / font.unitsPerEm;
  let x = 0;
  const parts = [];
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((glyph, i) => {
    parts.push(glyphPathData(glyph, x, scale));
    const next = glyphs[i + 1];
    const kern = next ? font.getKerningValue(glyph, next) : 0;
    x += (glyph.advanceWidth + kern) * scale + (next ? tracking * fontSize : 0);
  });
  const capHeight = (font.tables.os2.sCapHeight || 0.72 * font.unitsPerEm) * scale;
  return { d: parts.join(''), width: x, capHeight };
}

const WM_SIZE = 38;
const WM_TRACKING = 0.06;
const wm = wordmark('SVETLY', WM_SIZE, WM_TRACKING);

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(w)} ${fmt(h)}" role="img" aria-labelledby="t"><title id="t">${title}</title>\n${body}\n</svg>\n`;

// Horizontal lockup: mark 64 high, wordmark cap height centred on the mark.
const GAP = 16;
const horizW = 64 + GAP + wm.width;
const wmY = 32 + wm.capHeight / 2;
const horizontal = (mark, wmColor) =>
  svg(
    horizW,
    64,
    `${mark}\n<path transform="translate(${64 + GAP} ${fmt(wmY)})" d="${wm.d}" fill="${wmColor}"/>`,
    'SVETLY',
  );

// Vertical lockup.
const vertW = Math.max(64, wm.width);
const vertH = 64 + 14 + wm.capHeight;
const vertical = (mark, wmColor) =>
  svg(
    vertW,
    vertH,
    `<g transform="translate(${fmt((vertW - 64) / 2)} 0)">${mark}</g>\n<path transform="translate(${fmt((vertW - wm.width) / 2)} ${fmt(vertH)})" d="${wm.d}" fill="${wmColor}"/>`,
    'SVETLY',
  );

const files = {
  'svetly-logo.svg': horizontal(markFull(), C.deep),
  'svetly-logo-on-dark.svg': horizontal(markFull('m', true), C.ivory),
  'svetly-logo-vertical.svg': vertical(markFull(), C.deep),
  'svetly-logo-mono.svg': horizontal(markMono(C.deep), C.deep),
  'svetly-logo-inverse.svg': horizontal(markMono(C.ivory), C.ivory),
  'svetly-mark.svg': svg(64, 64, markFull(), 'SVETLY'),
  'svetly-mark-mono.svg': svg(64, 64, markMono(C.deep), 'SVETLY'),
  'svetly-mark-inverse.svg': svg(64, 64, markMono(C.ivory), 'SVETLY'),
  'svetly-mark-small.svg': svg(64, 64, markSmall(), 'SVETLY'),
};

await mkdir(out('public/brand'), { recursive: true });
for (const [name, content] of Object.entries(files)) {
  await writeFile(out('public/brand', name), content);
}
await writeFile(out('app/icon.svg'), files['svetly-mark-small.svg']);

// --- Raster derivatives ---------------------------------------------------------------------------
const png = (svgText, size, opts = {}) =>
  sharp(Buffer.from(svgText), { density: Math.ceil((72 * size) / 64) * 2 })
    .resize(size, size, {
      fit: 'contain',
      background: opts.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

// Maskable icon: full-bleed background, symbol inside the 80% safe zone.
const maskable = svg(
  64,
  64,
  `<rect width="64" height="64" fill="${C.deep}"/><g transform="translate(6.4 6.4) scale(0.8)">${markFull('mk')}</g>`,
  'SVETLY',
);

const rasters = {
  'public/brand/icon-192.png': await png(files['svetly-mark.svg'], 192),
  'public/brand/icon-512.png': await png(files['svetly-mark.svg'], 512),
  'public/brand/icon-maskable-512.png': await png(maskable, 512),
  'public/brand/social-avatar-400.png': await png(maskable, 400),
  'app/apple-icon.png': await png(maskable, 180),
};

// Open Graph 1200x630: light brand surface with the primary lockup.
const ogScale = 2.4;
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.ivory}"/>
<g transform="translate(${fmt((1200 - horizW * ogScale) / 2)} ${fmt((630 - 64 * ogScale) / 2)}) scale(${ogScale})">
${markFull('og')}
<path transform="translate(${64 + GAP} ${fmt(wmY)})" d="${wm.d}" fill="${C.deep}"/>
</g></svg>`;
rasters['public/brand/og-image.png'] = await sharp(Buffer.from(ogSvg))
  .png({ compressionLevel: 9 })
  .toBuffer();

for (const [path, buf] of Object.entries(rasters)) {
  await mkdir(dirname(out(path)), { recursive: true });
  await writeFile(out(path), buf);
}

// favicon.ico with embedded PNG images (16, 32, 48).
const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(icoSizes.map((s) => png(files['svetly-mark-small.svg'], s)));
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(icoImages[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += icoImages[i].length;
});
await writeFile(out('app/favicon.ico'), Buffer.concat([header, ...icoImages]));

// Path data for the React <Logo> component (inherits colour, no external requests).
const ts = `// Generated by scripts/generate-brand.mjs. Do not edit by hand.
export const MARK = ${JSON.stringify({ radius: M.radius, sun: M.sun, hill: M.hill, trees: M.trees, house: M.house, road: M.road }, null, 2)} as const;

export const WORDMARK = ${JSON.stringify({ d: wm.d, width: fmt(wm.width), capHeight: fmt(wm.capHeight), gap: GAP }, null, 2)} as const;
`;
await writeFile(out('components/brand/logo-geometry.ts'), ts);

console.log(
  'brand assets generated:',
  Object.keys(files).length,
  'svg,',
  Object.keys(rasters).length + 1,
  'raster',
);
