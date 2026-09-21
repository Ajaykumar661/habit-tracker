// ============================================================
// THEMES
// Each theme is one complete world: its room art for every time of day in
// both orientations, the effects layered over it, the wall the tallies are
// carved into, and its music. Everything a theme needs is described here,
// so switching theme is a single setting and no component has to know which
// world it is drawing.
//
// Art lives under public/assets/themes/<id>/ and is built from
// art-src/<id>/ by scripts/key-color.py and scripts/build-scene-fx.py.
// ============================================================

import { THEME_IDS, DEFAULT_THEME } from '../../domain/schema';
import medievalFx from './medieval/sceneFx.json';
import neonFx from './neon/sceneFx.json';

const base = (id) => `/assets/themes/${id}`;

// Regions are measured in each room image's own pixel grid, so every
// overlay stays registered to the artwork at any display size. The wall box
// is the keyed opening plus a 4px bleed.
function room(id, fx, frame, lighting, file) {
  return {
    ...frame,
    theme: id,
    lighting,
    src: `${base(id)}/environment/${file}`,
    fx: { key: `${frame.orientation}-${lighting}`, data: fx },
  };
}

// ---- Medieval Keep ------------------------------------------------------
// All three landscape rooms share one frame: their #FF00FF openings agree to
// within 3px (day x518-1212 y204-665, dusk x519-1209 y203-665, night
// x518-1211 y203-665), so one region set registers all of them and the
// tallies never shift when the time of day changes.
const MEDIEVAL_LANDSCAPE = {
  orientation: 'landscape',
  width: 1672,
  height: 941,
  regions: {
    wall: { x: 514, y: 199, w: 703, h: 471 },
    // stone lintel just above it: the routine name, kept small
    title: { x: 560, y: 164, w: 612, h: 34 },
  },
};
// Portrait: the archway sits ABOVE the wall instead of beside it, so a
// phone's cover-scaled crop keeps the sky in frame with the wall. All four
// openings agree to within 1px (dawn x225-713 y463-1192, day x225-714
// y464-1192, dusk x225-713 y463-1192, night x225-713 y463-1191).
const MEDIEVAL_PORTRAIT = {
  orientation: 'portrait',
  width: 941,
  height: 1672,
  regions: {
    wall: { x: 225, y: 463, w: 488, h: 729 },
    title: { x: 245, y: 428, w: 450, h: 32 },
  },
};

const medieval = {
  id: 'medieval',
  name: 'MEDIEVAL KEEP',
  landscape: {
    day: room('medieval', medievalFx, MEDIEVAL_LANDSCAPE, 'day', 'day-scene.png'),
    dusk: room('medieval', medievalFx, MEDIEVAL_LANDSCAPE, 'dusk', 'dusk-scene.png'),
    night: room('medieval', medievalFx, MEDIEVAL_LANDSCAPE, 'night', 'night-scene.png'),
  },
  // No dawn artwork for the landscape keep: 05:00-08:00 uses the dusk room
  // (warm low sun, lanterns still lit), the closest of the three.
  standIn: { dawn: 'dusk' },
  portrait: {
    dawn: room('medieval', medievalFx, MEDIEVAL_PORTRAIT, 'dawn', 'mobile-dawn-scene.png'),
    day: room('medieval', medievalFx, MEDIEVAL_PORTRAIT, 'day', 'mobile-day-scene.png'),
    dusk: room('medieval', medievalFx, MEDIEVAL_PORTRAIT, 'dusk', 'mobile-dusk-scene.png'),
    night: room('medieval', medievalFx, MEDIEVAL_PORTRAIT, 'night', 'mobile-night-scene.png'),
  },
  // One neutral stone panel, tiled square at the room's own stone size.
  wall: { src: `${base('medieval')}/environment/wall-surface.png`, tile: '24cqw 24cqw' },
};

// ---- Neon City ----------------------------------------------------------
// Keyed on green (the art is full of pink). The four landscape openings
// agree to within 1px (x469-1201 y312-640), as do the four portrait ones
// (x179-761 y576-1052).
const NEON_LANDSCAPE = {
  orientation: 'landscape',
  width: 1672,
  height: 941,
  regions: {
    wall: { x: 465, y: 308, w: 741, h: 337 },
    // the blank steel plate bolted above the opening
    title: { x: 560, y: 244, w: 556, h: 36 },
  },
};
const NEON_PORTRAIT = {
  orientation: 'portrait',
  width: 941,
  height: 1672,
  regions: {
    wall: { x: 175, y: 572, w: 591, h: 485 },
    title: { x: 245, y: 489, w: 450, h: 36 },
  },
};

const neon = {
  id: 'neon',
  name: 'NEON CITY',
  landscape: Object.fromEntries(['dawn', 'day', 'dusk', 'night'].map((t) => (
    [t, room('neon', neonFx, NEON_LANDSCAPE, t, `${t}-scene.png`)]))),
  standIn: {},
  portrait: Object.fromEntries(['dawn', 'day', 'dusk', 'night'].map((t) => (
    [t, room('neon', neonFx, NEON_PORTRAIT, t, `mobile-${t}-scene.png`)]))),
  // 3x3 concrete panels, seams at the edges, so the whole image tiles. Kept
  // at its own 1.633:1 aspect rather than squashed square; each panel comes
  // out about 14cqw wide.
  wall: { src: `${base('neon')}/environment/wall-surface.png`, tile: '42cqw 25.72cqw' },
};

export const THEMES = { medieval, neon };

// The domain layer owns the list of valid ids (it validates the setting);
// this registry must describe exactly those.
if (Object.keys(THEMES).join() !== THEME_IDS.join()) {
  throw new Error(`theme registry (${Object.keys(THEMES)}) out of step with THEME_IDS (${THEME_IDS})`);
}

export function themeFor(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME];
}

/** The room for this time of day, orientation and theme. */
export function sceneFor(envState, portrait, themeId) {
  const theme = themeFor(themeId);
  const set = portrait ? theme.portrait : theme.landscape;
  return set[envState] || set[theme.standIn[envState]] || set.day;
}

/** Where this theme's music for a time of day lives. */
export function musicFor(envState, themeId) {
  return `${base(themeFor(themeId).id)}/audio/${envState}.mp3`;
}
