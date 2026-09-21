// A share card: the wall as a picture, to post or send.
//
// 1080x1350 (4:5, what social feeds show uncropped). The top is the user's
// own portrait room -- the time of day and theme they are in, their tally
// marks cut into the wall, the objects they have earned on the shelf, the
// cat as she is kept -- and below it a plate with the day count.
//
// Nothing leaves the device unless the user shares it themselves: the image
// is drawn here, then handed to the system share sheet (or downloaded).

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { sceneFor, themeFor } from '../data/themes';
import { earnedMilestones, catLookFor } from '../domain/room';

export const CARD = { w: 1080, h: 1350, room: 960 };
const GATES_PER_ROW = 6;

const PALETTES = {
  medieval: { bg: '#1a1109', edge: '#8a6a3a', accent: '#e0a458', text: '#eae6d2', dim: '#9a967f', mark: 'rgba(236, 228, 205, 0.88)' },
  neon: { bg: '#07060f', edge: '#3ce8ff', accent: '#ff4fc8', text: '#e4e1ff', dim: '#8e8ab8', mark: 'rgba(255, 110, 210, 0.92)' },
};

/**
 * Where tally gates go inside the wall, filling rows of six from the top.
 * Marks beyond what fits are counted in `extra`, never squeezed smaller.
 * @returns {{ gates: Array<{ x: number, y: number, n: number }>, gw: number, gh: number, shown: number, extra: number }}
 */
export function tallyLayout(count, box) {
  const pad = box.w * 0.06;
  const gw = (box.w - pad * 2) / GATES_PER_ROW;
  const gh = gw * 0.85;
  const rowH = gh * 1.3;
  const rows = Math.max(1, Math.floor((box.h - pad * 2) / rowH));
  const capacity = rows * GATES_PER_ROW * 5;
  const shown = Math.min(Math.max(0, count), capacity);
  const gates = [];
  for (let i = 0; i * 5 < shown; i += 1) {
    gates.push({
      x: box.x + pad + (i % GATES_PER_ROW) * gw,
      y: box.y + pad + Math.floor(i / GATES_PER_ROW) * rowH,
      n: Math.min(5, shown - i * 5),
    });
  }
  return { gates, gw, gh, shown, extra: Math.max(0, count - shown) };
}

/**
 * The slice of the portrait room in frame: the wall's foot sits near the
 * bottom of the picture, unless the shelf's tallest object needs the top.
 */
export function roomWindow(scene, shelfTop) {
  const s = CARD.w / scene.width;
  const tall = CARD.room / s;
  const wall = scene.regions.wall;
  let top = wall.y + wall.h + 40 - tall;
  if (shelfTop != null) top = Math.min(top, shelfTop - 70);
  return { top: Math.max(0, top), scale: s };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

function drawGate(ctx, g, gw, gh, color, unit) {
  ctx.fillStyle = color;
  const stroke = Math.max(3, Math.round(unit));
  const step = gw * 0.16;
  for (let i = 0; i < Math.min(4, g.n); i += 1) {
    ctx.fillRect(Math.round(g.x + step * (i + 0.6)), Math.round(g.y), stroke, Math.round(gh));
  }
  if (g.n === 5) {
    // the fifth crosses the four, lower-left to upper-right, in pixel steps
    const steps = 10;
    for (let i = 0; i < steps; i += 1) {
      const x = g.x + step * 0.1 + (step * 4.2 * i) / steps;
      const y = g.y + gh - ((gh * 0.9) * (i + 1)) / steps;
      ctx.fillRect(Math.round(x), Math.round(y), stroke + 1, Math.round(gh / steps) + 1);
    }
  }
}

/**
 * Draw the card.
 * @returns {Promise<Blob>}
 */
export async function renderShareCard({ themeId, envState, name, streak, best, season, words }) {
  const theme = themeFor(themeId);
  const pal = PALETTES[theme.id] || PALETTES.medieval;
  const scene = sceneFor(envState, true, theme.id);
  const extras = theme.extras || {};
  const earned = earnedMilestones(extras.milestones, best).filter((m) => m.spots?.portrait);

  // the shelf's highest point, so the tallest trophy stays in frame
  let shelfTop = null;
  for (const m of earned) {
    const sp = m.spots.portrait;
    const h = m.flicker ? (sp.w * m.flicker.ch) / m.flicker.cw : (sp.w * m.h) / m.w;
    shelfTop = Math.min(shelfTop ?? Infinity, sp.y - h);
  }
  const { top, scale } = roomWindow(scene, shelfTop);
  const X = (x) => x * scale;
  const Y = (y) => (y - top) * scale;

  await document.fonts.load('24px "Press Start 2P"').catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = CARD.w;
  canvas.height = CARD.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, CARD.w, CARD.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CARD.w, CARD.room);
  ctx.clip();

  // the wall surface, tiled at the size the room draws it, with the marks
  const wall = scene.regions.wall;
  const [tile, roomArt] = await Promise.all([loadImage(theme.wall.src), loadImage(scene.src)]);
  const [tw, th] = theme.wall.tile.split(' ').map((v) => (parseFloat(v) / 100) * scene.width * scale);
  for (let y = Y(wall.y); y < Y(wall.y + wall.h); y += th) {
    for (let x = X(wall.x); x < X(wall.x + wall.w); x += tw) ctx.drawImage(tile, x, y, tw, th);
  }
  const box = { x: X(wall.x), y: Y(wall.y), w: X(wall.w), h: wall.h * scale };
  const t = tallyLayout(streak, box);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  for (const g of t.gates) drawGate(ctx, g, t.gw, t.gh, pal.mark, t.gw * 0.05);
  ctx.shadowColor = 'transparent';
  if (t.extra) {
    ctx.font = '22px "Press Start 2P"';
    ctx.fillStyle = pal.mark;
    ctx.textAlign = 'right';
    ctx.fillText(`+${t.extra}`, box.x + box.w - 20, box.y + box.h - 24);
  }

  // the room itself, its opening showing the wall behind
  ctx.drawImage(roomArt, 0, Y(0), scene.width * scale, scene.height * scale);

  // the shelf, and the season's piece
  // a sprite of drawn width sp.w standing on the line sp.y
  const stand = async (src, sp, iw, ih) => {
    const img = await loadImage(src);
    const h = (sp.w * ih) / iw;
    ctx.drawImage(img, X(sp.x - sp.w / 2), Y(sp.y - h), X(sp.w), h * scale);
  };
  for (const m of earned) {
    const sp = m.spots.portrait;
    if (m.flicker) {
      const f = m.flicker;
      const img = await loadImage(f.src);
      const h = (sp.w * f.ch) / f.cw;
      ctx.drawImage(img, 0, 0, img.width / f.frames, img.height, X(sp.x - sp.w / 2), Y(sp.y - h), X(sp.w), h * scale);
    } else {
      await stand(m.src, sp, m.w, m.h);
    }
  }
  const deco = extras.seasons?.[season]?.decoration;
  if (deco?.spots?.portrait) await stand(deco.src, deco.spots.portrait, deco.w, deco.h);

  // the cat, as she is kept
  const fx = scene.fx?.data;
  const spot = fx?.placements?.[scene.fx.key]?.cat?.[0];
  const strip = fx?.strips?.cat;
  if (spot && strip) {
    const img = await loadImage(strip.src);
    const h = (spot.w * strip.ch) / strip.cw;
    const catTop = spot.y - h / 2;
    const seam = strip.seam ?? 1;
    const look = catLookFor(extras.cat, best);
    const cellH = img.height;
    if (look) {
      // her ledge, then her bed or crown standing on it
      ctx.drawImage(img, 0, cellH * seam, strip.cw, cellH * (1 - seam),
        X(spot.x - spot.w / 2), Y(catTop + h * seam), X(spot.w), h * (1 - seam) * scale);
      const l = extras.cat[look];
      const lw = spot.w * l.rel;
      const lh = (lw * l.h) / l.w;
      const limg = await loadImage(l.src);
      ctx.drawImage(limg, X(spot.x - lw / 2), Y(catTop + h * seam - lh), X(lw), lh * scale);
    } else {
      ctx.drawImage(img, 0, 0, strip.cw, cellH, X(spot.x - spot.w / 2), Y(catTop), X(spot.w), h * scale);
    }
  }
  ctx.restore();

  // the plate
  const py = CARD.room;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, py, CARD.w, CARD.h - py);
  ctx.fillStyle = pal.edge;
  ctx.fillRect(0, py, CARD.w, 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font = '26px "Press Start 2P"';
  ctx.fillStyle = pal.dim;
  ctx.fillText(fit(ctx, name, CARD.w - 120), CARD.w / 2, py + 70);

  ctx.font = '96px "Press Start 2P"';
  ctx.fillStyle = '#000';
  ctx.fillText(`${words.day} ${streak}`, CARD.w / 2 + 6, py + 196);
  ctx.fillStyle = pal.accent;
  ctx.fillText(`${words.day} ${streak}`, CARD.w / 2, py + 190);

  ctx.font = '22px "Press Start 2P"';
  ctx.fillStyle = pal.text;
  ctx.fillText(`${words.best(best)}  ·  ${words.objects(earned.length, (extras.milestones || []).length)}`, CARD.w / 2, py + 262);

  ctx.font = '18px "Press Start 2P"';
  ctx.fillStyle = pal.dim;
  ctx.fillText(words.footer, CARD.w / 2, CARD.h - 40);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not draw the card'))), 'image/png');
  });
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}..`).width > max) out = out.slice(0, -1);
  return `${out}..`;
}

export function cardFilename(name) {
  const slug = String(name || 'wall').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `tally-wall-${slug || 'wall'}.png`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Hand the card to the system share sheet; in a browser without file
 * sharing, download it instead.
 * @returns {Promise<'shared' | 'saved' | 'cancelled'>}
 */
export async function shareCardImage(blob, filename) {
  const cancelled = (err) => /cancel|abort/i.test(String(err?.name || '') + String(err?.message || err));
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename, data: await blobToBase64(blob), directory: Directory.Cache,
    });
    try {
      await Share.share({ title: 'My Tally Wall', files: [uri] });
      return 'shared';
    } catch (err) {
      if (cancelled(err)) return 'cancelled';
      throw err;
    }
  }
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Tally Wall' });
      return 'shared';
    } catch (err) {
      if (cancelled(err)) return 'cancelled';
      throw err;
    }
  }
  downloadCard(blob, filename);
  return 'saved';
}

export function downloadCard(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
