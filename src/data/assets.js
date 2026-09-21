// ============================================================
// ASSET MANIFEST
//
// .js not .ts — this project has no TypeScript toolchain; same convention
// as quotes.js / attributions.js.
//
// ============================================================

// Room art, effects, wall textures and music are per theme: see
// src/data/themes/index.js.

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
