/**
 * NFR-16 / D103: checks text contrast of every theme's tokens. For `default` (base.css) and each
 * sheet in src/styles/themes/, every text token must reach 4.5:1 on every surface, and
 * --on-accent must reach 4.5:1 on the accent fills it sits on. Exit 1 on any failure.
 *
 *   npm run check:contrast
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles');
const MIN = 4.5;
const TEXT = ['--text', '--muted', '--role-a', '--role-b', '--danger', '--ok'];
const SURFACES = ['--bg', '--surface', '--surface-2'];
const ON_ACCENT = ['--role-a', '--role-b', '--danger'];

/** `{ themeName: { '--token': '#rrggbb' } }` from every [data-theme='x'] block in the CSS text. */
function tokensOf(css) {
  const themes = {};
  const block = /\[data-theme=['"]([\w-]+)['"]\]\s*\{([^}]*)\}/g;
  for (const [, name, body] of css.matchAll(block)) {
    themes[name] = themes[name] || {};
    for (const [, token, hex] of body.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) themes[name][token] = hex;
  }
  return themes;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const sheets = [join(STYLES, 'base.css'), ...readdirSync(join(STYLES, 'themes')).filter((f) => f.endsWith('.css')).map((f) => join(STYLES, 'themes', f))];
const themes = Object.assign({}, ...sheets.map((file) => tokensOf(readFileSync(file, 'utf8'))));
const base = themes.default;
let failures = 0;

for (const [name, own] of Object.entries(themes)) {
  const t = { ...base, ...own };
  const pairs = [
    ...TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg])),
    ...ON_ACCENT.map((bg) => ['--on-accent', bg]),
  ];
  const bad = pairs
    .map(([fg, bg]) => ({ fg, bg, r: ratio(t[fg], t[bg]) }))
    .filter((p) => p.r < MIN);
  const worst = Math.min(...pairs.map(([fg, bg]) => ratio(t[fg], t[bg])));
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${name.padEnd(8)} lowest ${worst.toFixed(2)}:1`);
  for (const p of bad) console.log(`       ${p.fg} on ${p.bg}: ${p.r.toFixed(2)}:1 (${t[p.fg]} on ${t[p.bg]})`);
  failures += bad.length;
}

if (failures) {
  console.log(`\n${failures} pair(s) under ${MIN}:1`);
  process.exit(1);
}
console.log(`\nAll ${Object.keys(themes).length} themes reach ${MIN}:1`);
