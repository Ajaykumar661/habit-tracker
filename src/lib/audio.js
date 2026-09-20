// One audio graph for the whole app.
//
// Music and sound effects used to build an AudioContext each. Safari caps
// how many a page may hold and charges real memory for every one, so they
// now share a single context and hang off named buses:
//
//     music deck A ─┐
//     music deck B ─┴─> [music gain] ─┐
//     effect blips ───> [ sfx gain ] ─┴─> destination
//
// Volume lives on the bus rather than on `audio.volume`, because iOS
// ignores writes to `volume` outright — a slider wired to it does nothing
// on an iPhone.
//
// Everything here degrades to silence rather than throwing: a browser with
// no Web Audio, or one that refuses a context before a user gesture, must
// still run the app.

const BUSES = ['music', 'sfx'];

let ctx = null;
let gains = null;
let failed = false;

/** The shared context, or null if audio is unavailable here. */
export function getContext() {
  if (ctx || failed) return ctx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('no Web Audio');
    ctx = new Ctor();
    gains = {};
    for (const name of BUSES) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(ctx.destination);
      gains[name] = g;
    }
  } catch {
    failed = true;                 // don't retry on every blip
    ctx = null;
  }
  return ctx;
}

/**
 * The gain node everything on `name` should connect to.
 * @returns {GainNode|null}
 */
export function bus(name) {
  return getContext() ? gains[name] || null : null;
}

/** Set a bus level. Ramped, so a dragged slider doesn't click. */
export function setBusVolume(name, value) {
  const g = bus(name);
  if (!g || !ctx) return;
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(v, t + 0.08);
}

/**
 * Browsers start a context suspended until a real gesture. Safe to call
 * often — resuming an already-running context is a no-op.
 */
export function resume() {
  const c = getContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** Reset — for tests only. */
export function _reset() {
  ctx = null;
  gains = null;
  failed = false;
}
