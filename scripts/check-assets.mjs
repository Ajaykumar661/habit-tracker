// Reports which artwork is in place. Run:  node scripts/check-assets.mjs
// Exits non-zero only if an asset the app currently REQUIRES is missing or
// malformed; planned assets are listed but don't fail the check.

import fs from 'node:fs';
import path from 'node:path';

const PUB = path.resolve(import.meta.dirname, '..', 'public');

// Every theme must ship the same set: room art for each time of day it
// claims, a wall texture, the shared effect sprite names, and its music.
const FX = ['flame-night', 'flame-dusk', 'star-warm', 'star-blue', 'star-pink', 'firefly', 'shoot',
  'ember-0', 'ember-1', 'ember-2', 'bat', 'bird', 'butterfly-orange', 'butterfly-blue', 'cat', 'static'];
const THEMES = {
  medieval: { landscape: ['day', 'dusk', 'night'] },   // no landscape dawn yet
  neon: { landscape: ['dawn', 'day', 'dusk', 'night'] },
};
const TIMES = ['dawn', 'day', 'dusk', 'night'];

const required = [
  ...Object.entries(THEMES).flatMap(([id, t]) => {
    const dir = `/assets/themes/${id}`;
    return [
      ...t.landscape.map((st) => ({ file: `${dir}/environment/${st}-scene.png`, alpha: true })),
      ...TIMES.map((st) => ({ file: `${dir}/environment/mobile-${st}-scene.png`, alpha: true })),
      { file: `${dir}/environment/wall-surface.png` },
      // effect sprites -- regenerate with scripts/build-scene-fx.py --theme <id>
      ...FX.map((n) => ({ file: `${dir}/fx/${n}.png`, alpha: true })),
      ...TIMES.map((st) => ({ file: `${dir}/audio/${st}.mp3` })),
    ];
  }),
  { file: '/fonts/press-start-2p.ttf' },
];
const planned = [
  { file: '/assets/themes/medieval/environment/dawn-scene.png', alpha: true },
  ...['board-wood', 'board-ledger', 'sign-hanging', 'parchment', 'button-wood', 'button-wood-hover',
    'button-wood-pressed', 'badge-plaque', 'badge-plaque-locked'].map((n) => ({ file: `/assets/ui/${n}.png`, alpha: true })),
];

function inspect({ file, alpha }) {
  const abs = path.join(PUB, file);
  if (!fs.existsSync(abs)) return 'missing';
  const buf = fs.readFileSync(abs);
  if (file.endsWith('.png') && buf.readUInt32BE(0) !== 0x89504e47) return 'not a PNG';
  if (!file.endsWith('.png')) return `ok (${(buf.length / 1024).toFixed(0)} kB)`;
  const colorType = buf[25]; // 6 RGBA, 4 grey+alpha, 3 palette
  if (alpha && ![3, 4, 6].includes(colorType)) return 'no alpha channel';
  return `ok (${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)})`;
}

let failed = 0;
console.log('REQUIRED');
for (const a of required) {
  const r = inspect(a);
  if (!r.startsWith('ok')) failed++;
  console.log(`  ${r.startsWith('ok') ? '✓' : '✗'} ${a.file}  ${r}`);
}
console.log('PLANNED');
for (const a of planned) console.log(`  ${inspect(a).startsWith('ok') ? '✓' : '·'} ${a.file}  ${inspect(a)}`);
process.exit(failed ? 1 : 0);
