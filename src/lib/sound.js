const MUTE_KEY = 'tally-wall-muted';

// Tiny synthesized 8-bit blips via Web Audio API — no audio files needed,
// fits the chiptune aesthetic and has zero load time / asset weight.
function createSoundFX() {
  let ctx = null;
  let muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, duration, opts = {}) {
    if (muted) return;
    try {
      const { type = 'square', vol = 0.15, delay = 0, slideTo = null } = opts;
      const c = getCtx();
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) { /* audio unavailable — fail silently */ }
  }

  return {
    isMuted: () => muted,
    setMuted(v) {
      muted = v;
      if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, v ? '1' : '0');
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
  };
}

export const SoundFX = createSoundFX();
