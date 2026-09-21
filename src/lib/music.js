// Background music: one looping chiptune per time of day, crossfaded when
// the world changes. Files are bundled locally (never streamed) so this
// works with no network, same as everything else.
//
// Two decks are kept alive and swapped between, rather than one element
// whose src changes, so a crossfade is possible at all. Both feed the
// shared `music` bus (see audio.js) rather than the destination directly,
// and gain runs through Web Audio rather than `audio.volume` because iOS
// ignores writes to `volume` entirely — the slider would do nothing on
// iPhone otherwise.

import { getContext, bus, resume } from './audio';

const KEY = 'tally-wall-music';
const FADE = 2.4;          // seconds to cross from one time of day to the next
const DEFAULTS = { on: true, vol: 0.55 };

function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* corrupt or unavailable — fall through to defaults */ }
  return { ...DEFAULTS };
}

function createMusic() {
  let prefs = loadPrefs();
  let ctx = null;
  let decks = [];
  let active = -1;          // index of the deck currently fading in / playing
  let wanted = null;        // src we should be playing, even if we can't yet
  let armed = false;        // has a user gesture let us start?

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }

  function build() {
    if (ctx) return true;
    try {
      ctx = getContext();
      if (!ctx) throw new Error('no audio');
      decks = [0, 1].map((i) => {
        const el = new Audio();
        el.loop = true;
        el.preload = 'none';
        el.crossOrigin = 'anonymous';
        // In the document (hidden) rather than detached: some mobile
        // browsers are happier about resuming a media element that is
        // actually in the tree, and it makes the state inspectable.
        el.dataset.musicDeck = String(i);
        el.style.display = 'none';
        document.body.appendChild(el);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(el).connect(gain).connect(bus('music') || ctx.destination);
        return { el, gain, src: null };
      });
      return true;
    } catch {
      ctx = null;
      return false;                 // no Web Audio — run without music
    }
  }

  function ramp(gain, to, seconds) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(to, t + seconds);
  }

  /** Swap to `src`, crossfading from whatever is playing. */
  function cross(src, seconds = FADE) {
    if (!build()) return;
    const from = active === -1 ? null : decks[active];
    if (from && from.src === src && !from.el.paused) return;

    // -1 -> 0, 0 -> 1, 1 -> 0
    const to = decks[(active + 1) % 2];

    if (to.src !== src) {
      to.src = src;
      to.el.src = src;
      to.el.preload = 'auto';
    }
    const started = to.el.play();
    if (started && started.catch) {
      // Blocked. Clear `armed` so the next gesture tries again rather than
      // leaving the session permanently silent.
      started.catch(() => { armed = false; });
    }
    ramp(to.gain, prefs.on ? prefs.vol : 0, seconds);
    active = decks.indexOf(to);

    if (from) {
      ramp(from.gain, 0, seconds);
      setTimeout(() => { if (decks[active] !== from) from.el.pause(); }, seconds * 1000 + 80);
    }
  }

  function stopAll(seconds = 0.6) {
    if (!ctx) return;
    decks.forEach((d) => {
      ramp(d.gain, 0, seconds);
      setTimeout(() => d.el.pause(), seconds * 1000 + 80);
    });
  }

  return {
    isOn: () => prefs.on,
    getVolume: () => prefs.vol,

    /**
     * Has playback actually begun? A gesture can be refused — Safari and
     * Chrome both reject play() in cases the page cannot predict — and the
     * caller needs to know so it can keep listening for another one.
     */
    isArmed: () => armed && decks.some((d) => !d.el.paused),

    /**
     * Called from a real user gesture — the only moment audio may start.
     * Idempotent, so it is safe to attach to every gesture rather than
     * only the first.
     */
    arm() {
      if (!prefs.on) return;
      if (armed && decks.some((d) => !d.el.paused)) return;
      if (!build()) return;
      armed = true;
      resume();
      if (wanted) cross(wanted, 0.8);
    },

    /**
     * The world changed -- a new time of day, or a new theme. Takes the
     * track's URL (see musicFor in data/themes) and crossfades to it, so a
     * theme switch sounds like the rest of the app's transitions.
     */
    playFor(src) {
      wanted = src;
      if (!prefs.on || !armed) return;
      resume();
      cross(wanted);
    },

    setOn(on) {
      prefs = { ...prefs, on };
      save();
      if (!on) { stopAll(); return; }
      armed = true;
      if (build()) resume();
      if (wanted) cross(wanted, 0.8);
    },

    setVolume(vol) {
      prefs = { ...prefs, vol };
      save();
      if (ctx && active >= 0 && prefs.on) ramp(decks[active].gain, vol, 0.12);
    },

    /** Backgrounded: hush rather than keep playing into a pocket. */
    setSuspended(hidden) {
      if (!ctx || !prefs.on) return;
      if (hidden) stopAll(0.4);
      else if (armed && wanted) cross(wanted, 0.8);
    },
  };
}

export const Music = createMusic();

if (import.meta.env.DEV && typeof window !== 'undefined') window.__music = Music;
