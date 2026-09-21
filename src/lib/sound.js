import { getContext, bus, setBusVolume, resume } from './audio';

const MUTE_KEY = 'tally-wall-muted';
const VOL_KEY = 'tally-wall-sfx-vol';
const DEFAULT_VOL = 0.8;

// Tiny synthesized 8-bit blips via Web Audio API — no audio files needed,
// fits the chiptune aesthetic and has zero load time / asset weight.
//
// Every blip runs through the shared `sfx` bus, so one slider governs them
// all and the level survives on iOS, where `audio.volume` is ignored.
function createSoundFX() {
  let muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  let masterVol = readVol();

  function readVol() {
    try {
      const raw = localStorage.getItem(VOL_KEY);
      if (raw === null) return DEFAULT_VOL;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : DEFAULT_VOL;
    } catch { return DEFAULT_VOL; }
  }

  function applyVol() {
    setBusVolume('sfx', muted ? 0 : masterVol);
  }

  function tone(freq, duration, opts = {}) {
    if (muted) return;
    try {
      const { type = 'square', vol = 0.15, delay = 0, slideTo = null } = opts;
      const c = getContext();
      if (!c) return;
      resume();
      applyVol();
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain).connect(bus('sfx') || c.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) { /* audio unavailable — fail silently */ }
  }

  return {
    /** Let the shared context out of its suspended state on a real gesture. */
    resume() { resume(); },

    isMuted: () => muted,
    setMuted(v) {
      muted = v;
      if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, v ? '1' : '0');
      applyVol();
    },

    getVolume: () => masterVol,
    setVolume(v) {
      masterVol = Math.max(0, Math.min(1, Number(v) || 0));
      try { localStorage.setItem(VOL_KEY, String(masterVol)); } catch { /* ignore */ }
      applyVol();
    },
    click() { tone(220, 0.05, { type: 'square', vol: 0.09 }); },
    open() { tone(520, 0.05, { type: 'square', vol: 0.08 }); },
    close() { tone(260, 0.05, { type: 'square', vol: 0.08 }); },
    tally() {
      tone(440, 0.07, { type: 'square', vol: 0.15 });
      tone(660, 0.09, { type: 'square', vol: 0.12, delay: 0.06 });
    },
    groupComplete() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { type: 'square', vol: 0.14, delay: i * 0.07 }));
    },
    milestone() {
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.19, delay: i * 0.09 }));
    },
    undo() { tone(320, 0.14, { type: 'sawtooth', vol: 0.12, slideTo: 110 }); },
    denied() { tone(120, 0.16, { type: 'square', vol: 0.1 }); },
    torch() {
      tone(180, 0.08, { type: 'triangle', vol: 0.1, slideTo: 260 });
    },
    /** The cat, petted: a low rumbling purr, then a small happy chirp. */
    purr() {
      for (let i = 0; i < 12; i += 1) {
        tone(i % 2 ? 62 : 74, 0.07, { type: 'triangle', vol: 0.16, delay: 0.25 + i * 0.09 });
      }
      tone(880, 0.09, { type: 'square', vol: 0.06, slideTo: 1320, delay: 1.45 });
    },
  };
}

export const SoundFX = createSoundFX();
