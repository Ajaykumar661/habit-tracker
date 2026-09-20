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

// All three landscape rooms share one frame: their #FF00FF openings agree
// to within 3px (day x518–1212 y204–665, dusk x519–1209 y203–665, night
// x518–1211 y203–665), so one region set — with a 4px bleed — registers all
// of them and the tallies never shift when the time of day changes.
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

// Desktop/landscape rooms — used above the NARROW breakpoint (see
// useSceneLayout's useIsNarrowViewport). No dawn artwork for this frame:
// 05:00–08:00 falls back to the dusk room (warm low sun, lanterns still
// lit), the closest of the three.
export const scenes = {
  day:   { ...ROOM, lighting: 'day',   src: '/assets/environment/day-scene.png',   fx: { key: 'landscape-day' } },
  dusk:  { ...ROOM, lighting: 'dusk',  src: '/assets/environment/dusk-scene.png',  fx: { key: 'landscape-dusk' } },
  night: { ...ROOM, lighting: 'night', src: '/assets/environment/night-scene.png', fx: { key: 'landscape-night' } },
};
const STAND_IN = { dawn: 'dusk' };

// Mobile/portrait rooms — same wall opening, but the archway sits ABOVE it
// instead of off to the side, so a phone's cover-scaled crop keeps the sky
// (sun/moon/castle vista) in frame together with the wall. Own frame size
// and region coordinates: this is a different image, not a crop of ROOM.
// All four openings agree to within 1px (dawn x225-713 y463-1192, day
// x225-714 y464-1192, dusk x225-713 y463-1192, night x225-713 y463-1191).
const ROOM_MOBILE = {
  width: 941,
  height: 1672,
  regions: {
    wall: { x: 225, y: 463, w: 488, h: 729 },
    // the stone lintel band between the archway's sill and the wall opening
    title: { x: 245, y: 428, w: 450, h: 32 },
  },
};

// All four times of day exist for this frame, so no stand-in needed here.
export const scenesMobile = {
  dawn:  { ...ROOM_MOBILE, lighting: 'dawn',  src: '/assets/environment/mobile-dawn-scene.png', fx: { key: 'portrait-dawn' } },
  day:   { ...ROOM_MOBILE, lighting: 'day',   src: '/assets/environment/mobile-day-scene.png', fx: { key: 'portrait-day' } },
  dusk:  { ...ROOM_MOBILE, lighting: 'dusk',  src: '/assets/environment/mobile-dusk-scene.png', fx: { key: 'portrait-dusk' } },
  night: { ...ROOM_MOBILE, lighting: 'night', src: '/assets/environment/mobile-night-scene.png', fx: { key: 'portrait-night' } },
};

export function sceneFor(envState, mobile) {
  const set = mobile ? scenesMobile : scenes;
  return set[envState] || set[STAND_IN[envState]] || set.day;
}

/** One neutral stone panel shown through the wall opening. Tileable, so the
 *  tally area can scroll and the marks stay on the same stones. */
export const wallSurface = { src: '/assets/environment/wall-surface.png' };

// ---- Planned, not yet supplied -----------------------------------------

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
