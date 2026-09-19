// ============================================================
// ASSET MANIFEST
//
// .js not .ts — this project has no TypeScript toolchain; same convention
// as quotes.js / attributions.js.
//
// Each scene is ONE flattened room image whose wall opening was supplied as
// flat #FF00FF and keyed to real alpha by scripts/key-magenta.py. The
// regions below are measured in that image's own pixel grid, so every
// overlay stays registered to the artwork at any display size.
// ============================================================

// All three rooms share one frame: their #FF00FF openings agree to within
// 3px (day x518–1212 y204–665, dusk x519–1209 y203–665, night x518–1211
// y203–665), so one region set — with a 4px bleed — registers all of them
// and the tallies never shift when the time of day changes.
const ROOM = {
  width: 1672,
  height: 941,
  regions: {
    // the wall opening, where the tally marks live
    wall: { x: 514, y: 199, w: 703, h: 471 },
    // stone lintel just above it: the routine name, kept small
    title: { x: 560, y: 164, w: 612, h: 34 },
  },
};

export const scenes = {
  day:   { ...ROOM, lighting: 'day',   src: '/assets/environment/day-scene.png' },
  dusk:  { ...ROOM, lighting: 'dusk',  src: '/assets/environment/dusk-scene.png' },
  night: { ...ROOM, lighting: 'night', src: '/assets/environment/night-scene.png' },
};

// No dawn artwork: 05:00–08:00 uses the dusk room (warm low sun, lanterns
// still lit), the closest of the three. Replace with a dawn-scene.png when
// one exists — same framing, same magenta rectangle.
const STAND_IN = { dawn: 'dusk' };

export function sceneFor(envState) {
  return scenes[envState] || scenes[STAND_IN[envState]] || scenes.day;
}

/** One neutral stone panel shown through the wall opening. Tileable, so the
 *  tally area can scroll and the marks stay on the same stones. */
export const wallSurface = { src: '/assets/environment/wall-surface.png' };

// ---- Planned, not yet supplied -----------------------------------------

/** Animated lantern flame for dusk/night, composited over unlit housings. */
export const flameSheet = { src: '/assets/props/flame-sheet.png', frames: 6, fps: 8 };

/** 9-slice UI surfaces (border inset in source px, for border-image-slice).
 *  Until these exist the panels below the scene use plain CSS surfaces. */
const NINE_SLICE_INSET = 32;
export const uiAssets = {
  boardWood:         { src: '/assets/ui/board-wood.png',          inset: NINE_SLICE_INSET },
  boardLedger:       { src: '/assets/ui/board-ledger.png',        inset: NINE_SLICE_INSET },
  signHanging:       { src: '/assets/ui/sign-hanging.png',        inset: NINE_SLICE_INSET },
  parchment:         { src: '/assets/ui/parchment.png',           inset: NINE_SLICE_INSET },
  buttonWood:        { src: '/assets/ui/button-wood.png',         inset: NINE_SLICE_INSET },
  buttonWoodHover:   { src: '/assets/ui/button-wood-hover.png',   inset: NINE_SLICE_INSET },
  buttonWoodPressed: { src: '/assets/ui/button-wood-pressed.png', inset: NINE_SLICE_INSET },
  badgePlaque:       { src: '/assets/ui/badge-plaque.png',        inset: NINE_SLICE_INSET },
  badgePlaqueLocked: { src: '/assets/ui/badge-plaque-locked.png', inset: NINE_SLICE_INSET },
};
