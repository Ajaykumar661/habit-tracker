// Reports which artwork is in place. Run:  node scripts/check-assets.mjs
// Exits non-zero only if an asset the app currently REQUIRES is missing or
// malformed; planned assets are listed but don't fail the check.

import fs from 'node:fs';
import path from 'node:path';

const PUB = path.resolve(import.meta.dirname, '..', 'public');

const required = [
  ...['day', 'dusk', 'night'].map((st) => ({ file: `/assets/environment/${st}-scene.png`, alpha: true })),
  { file: '/assets/environment/wall-surface.png' },
];
const planned = [
  { file: '/assets/environment/dawn-scene.png', alpha: true },
  { file: '/assets/props/flame-sheet.png', alpha: true },
  ...['board-wood', 'board-ledger', 'sign-hanging', 'parchment', 'button-wood', 'button-wood-hover',
    'button-wood-pressed', 'badge-plaque', 'badge-plaque-locked'].map((n) => ({ file: `/assets/ui/${n}.png`, alpha: true })),
];

function inspect({ file, alpha }) {
  const abs = path.join(PUB, file);
  if (!fs.existsSync(abs)) return 'missing';
  const buf = fs.readFileSync(abs);
  if (buf.readUInt32BE(0) !== 0x89504e47) return 'not a PNG';
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
