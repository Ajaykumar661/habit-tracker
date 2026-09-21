"""Compose and render the Neon City soundtrack as genuine 8-bit chiptune.

    python scripts/compose-neon-music.py            # render all four
    python scripts/compose-neon-music.py night      # just one

Nothing here is sampled or downloaded: every sound is synthesised the way
the NES's 2A03 sound chip makes it, and nothing the chip couldn't do is
added afterwards.

    pulse 1, pulse 2   square waves at the chip's four duty cycles
    triangle           the 32-step, 4-bit stepped triangle (no volume
                       control -- it is either sounding or frozen)
    noise              the 15-bit LFSR, long and short (metallic) modes,
                       at the chip's own sixteen clock periods

Volumes are 4-bit (0-15) and change once per 60 Hz frame, pitches are
snapped to the chip's 11-bit timer (so notes carry its slight detuning),
vibrato and arpeggios are applied per frame in software exactly as games
of the era did, and the channels are combined with the NES's documented
nonlinear mixer. The only processing after that is the console's own
output filtering (a DC-blocking high-pass and a gentle low-pass), then
level-matching to the medieval tracks.

The songs are written as a tiny tracker: sixteen steps to a bar, one row of
tokens per bar and channel. Change a melody below, re-run, and the MP3s in
public/assets/themes/neon/audio/ are rebuilt.

Each track is a seamless loop: the song is rendered three times over and the
middle pass kept, so release tails from the end already ring into the start,
and a 25 ms crossfade from the third pass hides the oscillators' phase jump
at the seam.
"""
import math
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'public/assets/themes/neon/audio'

SR = 44100
FRAME = SR // 60                 # 735 samples per 60 Hz frame
CPU = 1789773                    # NTSC 2A03 clock
TARGET_LUFS = -23.0              # same level as the medieval set
BITRATE = '128k'

NOISE_PERIODS = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068]
NOTE_NAMES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6,
              'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def midi(name):
    """'A4' -> 69, 'C#5' -> 73."""
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + NOTE_NAMES[pitch]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pulse_hz(f):
    """Snap to the pulse channel's 11-bit timer: f = CPU / (16 (t + 1))."""
    t = max(8, min(2047, round(CPU / (16 * f) - 1)))
    return CPU / (16 * (t + 1))


def tri_hz(f):
    t = max(2, min(2047, round(CPU / (32 * f) - 1)))
    return CPU / (32 * (t + 1))


# ---------------------------------------------------------------------------
# Instruments: per-frame 4-bit volume macros, as in a tracker.
# `attack` plays once on note-on; `hold` is the level while the note is held;
# `release` plays once on note-off (or when the next note steals the channel).
# ---------------------------------------------------------------------------
INSTR = {
    'lead':  {'duty': 0.25,  'attack': [11, 12, 12, 11], 'hold': 10, 'release': [7, 5, 3, 2, 1, 0],
              'vib': (14, 5.2, 18)},     # (delay frames, rate Hz, depth cents)
    'lead50': {'duty': 0.5,  'attack': [12, 13, 12, 11], 'hold': 10, 'release': [7, 5, 3, 1, 0],
               'vib': (12, 5.8, 16)},
    'soft':  {'duty': 0.25,  'attack': [6, 8, 8, 7], 'hold': 7, 'release': [5, 4, 3, 2, 1, 0],
              'vib': (18, 4.4, 14)},
    'pluck': {'duty': 0.125, 'attack': [8, 7, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1], 'hold': 0, 'release': [0],
              'vib': None},
    'pad':   {'duty': 0.125, 'attack': [3, 4, 5, 5], 'hold': 5, 'release': [4, 3, 2, 1, 0],
              'vib': None},
}

# Drums on the noise channel: (mode short?, period index, volume macro).
DRUMS = {
    'k': (False, 13, [15, 13, 10, 7, 4, 2, 0]),               # kick
    's': (False, 7, [14, 13, 11, 9, 8, 6, 5, 4, 3, 2, 1, 0]),  # snare
    'h': (True, 1, [6, 3, 1, 0]),                             # closed hat (metallic)
    'o': (True, 2, [7, 6, 5, 4, 3, 2, 1, 0]),                 # open hat
    'g': (False, 3, [4, 2, 0]),                               # ghost tick
}


# ---------------------------------------------------------------------------
# Tracker parsing. A bar is 16 whitespace-separated tokens:
#   A4 / C#5   note on       .   hold previous      -   note off
# Drum bars use single characters per step: k s h o g, and . for nothing.
# ---------------------------------------------------------------------------
def parse_bar(text):
    toks = text.split()
    if len(toks) != 16:
        raise SystemExit(f'bar needs 16 steps, got {len(toks)}: {text!r}')
    return toks


def parse_drums(text):
    s = text.replace(' ', '')
    if len(s) != 16:
        raise SystemExit(f'drum bar needs 16 steps, got {len(s)}: {text!r}')
    return list(s)


def step_frames(bpm, n_steps):
    """Frame index each 16th-note step starts on (groove for fractional
    frames-per-step, the way FamiTracker alternates row lengths)."""
    fpr = 3600.0 / (bpm * 4)
    return [round(i * fpr) for i in range(n_steps + 1)]


def melodic_events(bars):
    """Flatten bar strings into per-step tokens."""
    out = []
    for b in bars:
        out += parse_bar(b)
    return out


def render_melodic(tokens, starts, total_frames, instr, arp=None, octave_shift=0):
    """Per-frame (freq, vol, duty) for a pulse channel.

    `arp`, if given, is a per-step list of semitone offset tuples: the note
    is then played as a chip-chord, cycling through the offsets one frame at
    a time -- the classic way a single 8-bit channel plays a chord.
    """
    ins = INSTR[instr]
    freq = np.zeros(total_frames)
    vol = np.zeros(total_frames)
    note = None
    on_frame = 0
    releasing = None          # frame the current release started
    rel_note = None
    for i, tok in enumerate(tokens):
        f0, f1 = starts[i], starts[i + 1]
        if tok not in ('.', '-'):
            note = midi(tok) + octave_shift
            on_frame = f0
            releasing = None
        elif tok == '-' and note is not None and releasing is None:
            releasing, rel_note = f0, note
            note = None
        for fr in range(f0, f1):
            if fr >= total_frames:
                break
            if note is not None:
                k = fr - on_frame
                v = ins['attack'][k] if k < len(ins['attack']) else ins['hold']
                m = note
                if arp and arp[i]:
                    m = note + arp[i][k % len(arp[i])]
                f = hz(m)
                if ins['vib'] and k >= ins['vib'][0]:
                    d, rate, cents = ins['vib']
                    f *= 2 ** ((cents * math.sin(2 * math.pi * rate * (k - d) / 60)) / 1200)
                freq[fr] = pulse_hz(f)
                vol[fr] = v
            elif releasing is not None:
                k = fr - releasing
                if k < len(ins['release']):
                    freq[fr] = pulse_hz(hz(rel_note))
                    vol[fr] = ins['release'][k]
    return freq, vol, ins['duty']


def render_triangle(tokens, starts, total_frames, gap=1):
    """Per-frame (freq, on) for the triangle. It has no volume: a note is on
    or off. `gap` frames of silence before each new note keep repeated notes
    articulated, as bass lines on the chip were written."""
    freq = np.zeros(total_frames)
    on = np.zeros(total_frames)
    note = None
    for i, tok in enumerate(tokens):
        f0, f1 = starts[i], starts[i + 1]
        if tok not in ('.', '-'):
            note = midi(tok)
        elif tok == '-':
            note = None
        for fr in range(f0, min(f1, total_frames)):
            if note is not None and not (tok not in ('.', '-') and fr < f0 + gap and i > 0):
                freq[fr] = tri_hz(hz(note))
                on[fr] = 1
    return freq, on


def render_noise(steps, starts, total_frames):
    """Per-frame (period index, short mode, vol) for the noise channel."""
    per = np.zeros(total_frames, dtype=int)
    short = np.zeros(total_frames, dtype=bool)
    vol = np.zeros(total_frames)
    for i, c in enumerate(steps):
        if c == '.':
            continue
        mode, p, env = DRUMS[c]
        f0 = starts[i]
        for k, v in enumerate(env):
            fr = f0 + k
            if fr >= total_frames:
                break
            # a new hit cuts the previous one, as on the real channel
            per[fr] = p
            short[fr] = mode
            vol[fr] = v
    return per, short, vol


# ---------------------------------------------------------------------------
# Synthesis
# ---------------------------------------------------------------------------
def frames_to_samples(a):
    return np.repeat(np.asarray(a, dtype=np.float64), FRAME)


def polyblep(t, dt):
    out = np.zeros_like(t)
    a = t < dt
    x = t[a] / dt[a]
    out[a] = x + x - x * x - 1
    b = t > 1 - dt
    x = (t[b] - 1) / dt[b]
    out[b] = x * x + x + x + 1
    return out


def synth_pulse(freq_f, vol_f, duty):
    """Band-limited pulse, unipolar 0..vol as the chip's DAC sees it."""
    f = frames_to_samples(freq_f)
    v = frames_to_samples(vol_f)
    dt = np.maximum(f / SR, 1e-9)
    phase = np.cumsum(dt) % 1.0
    sq = np.where(phase < duty, 1.0, -1.0)
    sq += polyblep(phase, dt)
    sq -= polyblep((phase + 1 - duty) % 1.0, dt)
    return (sq + 1) / 2 * np.round(v)


TRI_SEQ = np.array(list(range(15, -1, -1)) + list(range(0, 16)), dtype=np.float64)


def synth_triangle(freq_f, on_f):
    """The 32-step triangle. When a note stops the sequencer freezes where it
    is rather than dropping to zero -- that is what the hardware does, and
    the output high-pass removes the held level."""
    f = frames_to_samples(freq_f * on_f)
    phase = np.cumsum(f / SR)
    idx = np.floor(phase * 32).astype(np.int64) % 32
    return TRI_SEQ[idx]


def lfsr_sequence(short):
    reg = 1
    tap = 6 if short else 1
    n = 93 * 4 if short else 32767
    bits = np.empty(n, dtype=np.float64)
    for i in range(n):
        bits[i] = 1.0 if (reg & 1) == 0 else 0.0
        fb = (reg & 1) ^ ((reg >> tap) & 1)
        reg = (reg >> 1) | (fb << 14)
    return bits


LONG_NOISE = lfsr_sequence(False)
SHORT_NOISE = lfsr_sequence(True)


def synth_noise(per_f, short_f, vol_f):
    rate = np.array([CPU / NOISE_PERIODS[p] for p in per_f])
    r = frames_to_samples(rate)
    clocks = np.floor(np.cumsum(r / SR)).astype(np.int64)
    s = frames_to_samples(short_f.astype(float)) > 0.5
    out = np.where(s, SHORT_NOISE[clocks % len(SHORT_NOISE)], LONG_NOISE[clocks % len(LONG_NOISE)])
    return out * np.round(frames_to_samples(vol_f))


def nes_mix(p1, p2, tri, noise):
    """The 2A03's nonlinear mixer (from the NESdev wiki's formulas)."""
    ps = p1 + p2
    pulse = np.where(ps > 0, 95.88 / (8128.0 / np.maximum(ps, 1e-9) + 100), 0.0)
    tn = tri / 8227.0 + noise / 12241.0
    tnd = np.where(tn > 0, 159.79 / (1.0 / np.maximum(tn, 1e-12) + 100), 0.0)
    return pulse + tnd


def one_pole_hp(x, fc):
    a = 1.0 / (1.0 + 2 * math.pi * fc / SR)
    y = np.empty_like(x)
    prev_x = x[0]
    prev_y = 0.0
    for i in range(len(x)):
        prev_y = a * (prev_y + x[i] - prev_x)
        prev_x = x[i]
        y[i] = prev_y
    return y


def one_pole_lp(x, fc):
    a = 2 * math.pi * fc / SR / (1 + 2 * math.pi * fc / SR)
    y = np.empty_like(x)
    acc = x[0]
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


# ---------------------------------------------------------------------------
# Composition helpers
# ---------------------------------------------------------------------------
QUALITY = {'min': (0, 3, 7), 'maj': (0, 4, 7), 'min7': (0, 3, 7, 10), 'maj7': (0, 4, 7, 11),
           'sus2': (0, 2, 7), 'add9': (0, 4, 7, 14), '6': (0, 4, 7, 9)}


def chord_notes(root, quality):
    base = midi(root)
    return [base + o for o in QUALITY[quality]]


def name(m):
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return f'{names[m % 12]}{m // 12 - 1}'


def arp_bar(root, quality, shape):
    """A bar of broken-chord 16ths for pulse 2."""
    n = chord_notes(root, quality)
    tones = n + [n[0] + 12, n[1] + 12]
    idx = {'up': [0, 1, 2, 3, 4, 3, 2, 1] * 2,
           'roll': [0, 2, 1, 3, 2, 4, 3, 2] * 2,
           'pulse': [0, 2, 3, 2] * 4}[shape]
    return ' '.join(name(tones[i % len(tones)]) for i in idx)


def pad_bar(root, quality):
    """One sustained chip-chord for the whole bar."""
    return ' '.join([name(midi(root))] + ['.'] * 15)


def pad_arp(quality):
    return tuple(QUALITY[quality][:3])


def bass_bar(root, style):
    r = midi(root)
    lo, hi, fifth = name(r), name(r + 12), name(r + 7)
    return {
        'eighths': f'{lo} . {lo} . {lo} . {hi} . {lo} . {lo} . {hi} . {lo} .',
        'octave':  f'{lo} . {hi} . {lo} . {hi} . {lo} . {hi} . {lo} . {hi} .',
        'drive':   f'{lo} {lo} {hi} {lo} {lo} {lo} {hi} {lo} {lo} {lo} {hi} {lo} {lo} {lo} {hi} {fifth}',
        'bounce':  f'{lo} . . {fifth} . . {hi} . {lo} . . {fifth} . . {hi} .',
        'long':    f'{lo} . . . . . . . . . . . {fifth} . . .',
        'half':    f'{lo} . . . . . . . {fifth} . . . . . . .',
    }[style]


# ---------------------------------------------------------------------------
# The four songs. Progressions repeat every four bars; `sections` lists which
# layers play in each bar. Melodies are written out by hand.
# ---------------------------------------------------------------------------
REST = '- . . . . . . . . . . . . . . .'
HOLD = '. . . . . . . . . . . . . . . .'

SONGS = {}

# NIGHT -- "Neon Rain". A minor, i-VI-III-VII, the classic synthwave turn.
# Rain on the glass: hats and a slow, singing lead over a pumping bass.
SONGS['night'] = {
    'bpm': 96,
    'prog': [('A2', 'min'), ('F2', 'maj'), ('C3', 'maj'), ('G2', 'maj')],
    'arp_root_oct': 2,     # arps an octave+ above the bass root
    'lead_instr': 'lead',
    'lead': (
        [REST] * 4 +
        [  # A
            'E5 . . . . . D5 . C5 . . . A4 . . .',
            'C5 . . . D5 . . . E5 . . . . . - .',
            'G5 . . . . . E5 . D5 . . . C5 . D5 .',
            'B4 . . . . . . . D5 . . . - . . .',
            'E5 . . . . . G5 . A5 . . . . . G5 .',
            'A5 . . . F5 . . . E5 . . . C5 . . .',
            'D5 . . . E5 . . . G5 . . . E5 . D5 .',
            'E5 . . . . . . . . . . . - . . .',
        ] +
        [  # B
            'A5 . - A5 G5 . E5 . - . E5 . G5 . A5 .',
            'C6 . . . A5 . . . G5 . . . F5 . E5 .',
            'G5 . - G5 E5 . C5 . - . C5 . D5 . E5 .',
            'D5 . . . . . . . B4 . . . D5 . . .',
            'A5 . - A5 G5 . E5 . - . E5 . G5 . A5 .',
            'C6 . . . D6 . C6 . A5 . . . G5 . . .',
            'E5 . . . G5 . . . C6 . . . B5 . G5 .',
            'A5 . . . . . . . . . . . - . . .',
        ] +
        [REST] * 4
    ),
    'arp_style': ['pad'] * 4 + ['up'] * 16 + ['pad'] * 4,
    'bass_style': ['long'] * 4 + ['eighths'] * 8 + ['octave'] * 8 + ['long'] * 4,
    'drums': (
        ['h . h . h . h . h . h . h . h .'] * 3 + ['h . h . h . h . h . h . s . s s'] +
        ['k . h . s . h . k . h k s . h g'] * 7 + ['k . h . s . h . k . s . s . s s'] +
        ['k . h . s . h g k . h k s . h g'] * 7 + ['k . h . s . h . k . s s s s s s'] +
        ['h . h . h . h . h . h . h . h .'] * 3 + ['h . h . h . h . h . o . . . . .']
    ),
}

# DUSK -- "Sunset Protocol". E minor, i-VI-III-VII, faster and brighter: the
# city switching its lights on.
SONGS['dusk'] = {
    'bpm': 112.5,
    'prog': [('E2', 'min'), ('C2', 'maj'), ('G2', 'maj'), ('D2', 'maj')],
    'arp_root_oct': 2,
    'lead_instr': 'lead50',
    'lead': (
        [REST] * 4 +
        [  # A
            'B4 . . . E5 . . . G5 . F#5 . E5 . . .',
            'E5 . . . . . G5 . - . G5 . A5 . G5 .',
            'D5 . . . . . B4 . D5 . . . G5 . . .',
            'F#5 . . . . . . . . . . . - . . .',
            'B4 . . . E5 . . . G5 . F#5 . E5 . . .',
            'G5 . . . A5 . . . B5 . . . A5 . G5 .',
            'B5 . . . . . A5 . G5 . . . D5 . . .',
            'F#5 . . . . . . . E5 . . . - . . .',
        ] +
        [  # B -- the hook, higher and chopped
            'E6 . - E6 D6 . B5 . - . B5 . D6 . E6 .',
            'E6 . . . G6 . . . E6 . D6 . B5 . . .',
            'D6 . - D6 B5 . G5 . - . G5 . A5 . B5 .',
            'A5 . . . . . . . F#5 . . . A5 . . .',
            'E6 . - E6 D6 . B5 . - . B5 . D6 . E6 .',
            'G6 . . . E6 . . . D6 . . . B5 . . .',
            'D6 . . . B5 . . . G5 . . . A5 . B5 .',
            'E6 . . . . . . . . . . . - . . .',
        ] +
        [  # A' -- the verse again, an octave lower, winding down
            'B4 . . . E5 . . . G5 . F#5 . E5 . . .',
            'E5 . . . . . G5 . - . G5 . A5 . G5 .',
            'D5 . . . . . B4 . D5 . . . G5 . . .',
            'F#5 . . . . . . . . . . . - . . .',
            'G5 . . . . . F#5 . E5 . . . B4 . . .',
            'C5 . . . . . E5 . G5 . . . E5 . . .',
            'D5 . . . . . B4 . G4 . . . B4 . D5 .',
            'E5 . . . . . . . . . . . - . . .',
        ]
    ),
    'arp_style': ['pad'] * 4 + ['roll'] * 24,
    'bass_style': ['half'] * 4 + ['drive'] * 16 + ['eighths'] * 8,
    'drums': (
        ['h . h h h . h h h . h h h . h h'] * 3 + ['h . h h h . h h s . s . s s s s'] +
        ['k . h . s . h k k . h . s . h g'] * 7 + ['k . h . s . h k k . s . s s s s'] +
        ['k h h k s h h h k h k h s h h o'] * 7 + ['k . k . s . s . k k s s s s s s'] +
        ['k . h . s . h k k . h . s . h g'] * 7 + ['k . h . s . h . k . . . o . . .']
    ),
}

# DAWN -- "First Light". D major, soft: Dmaj7-Bm7-Gmaj7-A. Chip-chord pads,
# a lyrical lead, the city waking slowly.
SONGS['dawn'] = {
    'bpm': 80,
    'prog': [('D2', 'maj7'), ('B1', 'min7'), ('G1', 'maj7'), ('A1', 'sus2')],
    'arp_root_oct': 2,
    'lead_instr': 'soft',
    'lead': (
        [REST] * 4 +
        [
            'F#5 . . . . . A5 . . . . . E5 . . .',
            'D5 . . . . . . . C#5 . D5 . F#5 . . .',
            'B4 . . . . . D5 . . . . . G5 . F#5 .',
            'E5 . . . . . . . . . . . - . . .',
            'F#5 . . . . . A5 . . . . . D6 . . .',
            'C#6 . . . . . B5 . A5 . . . F#5 . . .',
            'G5 . . . . . F#5 . E5 . . . D5 . . .',
            'E5 . . . . . . . . . . . - . . .',
        ] +
        [
            'A5 . . . . . F#5 . . . . . A5 . . .',
            'B5 . . . . . F#5 . D5 . . . . . . .',
            'G5 . . . . . B5 . . . . . D6 . C#6 .',
            'B5 . . . A5 . . . . . . . - . . .',
            'F#5 . . . . . G5 . A5 . . . D6 . . .',
            'C#6 . . . . . . . B5 . . . F#5 . . .',
            'G5 . . . F#5 . . . E5 . . . C#5 . . .',
            'D5 . . . . . . . . . . . - . . .',
        ]
    ),
    'arp_style': ['pad'] * 12 + ['pulse'] * 8,
    'bass_style': ['long'] * 12 + ['half'] * 8,
    'drums': (
        ['. . h . . . h . . . h . . . h .'] * 4 +
        ['. . h . . . h . . . h . . . h g'] * 8 +
        ['k . h . . . h . k . h . . . h .'] * 7 + ['k . h . . . h . k . h . o . . .']
    ),
}

# DAY -- "Transit Line". F major, I-V-vi-IV, bouncy: trains on the viaduct,
# drones on their rounds.
SONGS['day'] = {
    'bpm': 120,
    'prog': [('F2', 'maj'), ('C2', 'maj'), ('D2', 'min'), ('A#1', 'maj')],
    'arp_root_oct': 2,
    'lead_instr': 'lead50',
    'lead': (
        [REST] * 4 +
        [  # A
            'A5 . . C6 . . A5 . G5 . F5 . G5 . A5 .',
            'G5 . . . . . E5 . C5 . . . - . . .',
            'F5 . . A5 . . F5 . E5 . D5 . E5 . F5 .',
            'D5 . . . . . . . - . . . C5 . D5 .',
            'A5 . . C6 . . A5 . G5 . F5 . G5 . A5 .',
            'C6 . . . . . G5 . E5 . . . G5 . . .',
            'A5 . . . G5 . . . F5 . . . D5 . . .',
            'F5 . . . . . . . - . . . . . . .',
        ] +
        [  # B -- call and answer
            'C6 . - C6 A5 . C6 . D6 . C6 . A5 . . .',
            'G5 . - G5 E5 . G5 . A5 . G5 . E5 . . .',
            'A5 . - A5 F5 . A5 . A#5 . A5 . F5 . . .',
            'F5 . - F5 D5 . F5 . G5 . F5 . D5 . . .',
            'C6 . - C6 A5 . C6 . D6 . C6 . A5 . . .',
            'E6 . . . D6 . . . C6 . . . G5 . . .',
            'A5 . . . C6 . . . D6 . . . C6 . A5 .',
            'A#5 . . . A5 . . . G5 . . . - . . .',
        ] +
        [  # A again, straight into the loop
            'A5 . . C6 . . A5 . G5 . F5 . G5 . A5 .',
            'G5 . . . . . E5 . C5 . . . - . . .',
            'F5 . . A5 . . F5 . E5 . D5 . E5 . F5 .',
            'D5 . . . . . . . - . . . C5 . D5 .',
            'A5 . . C6 . . A5 . G5 . F5 . G5 . A5 .',
            'C6 . . . . . G5 . E5 . . . G5 . . .',
            'A5 . . . G5 . . . F5 . . . E5 . D5 .',
            'C5 . . . . . . . - . . . . . . .',
        ]
    ),
    'arp_style': ['pulse'] * 4 + ['up'] * 24,
    'bass_style': ['bounce'] * 12 + ['octave'] * 8 + ['bounce'] * 8,
    'drums': (
        ['k . h . s . h . k . h . s . h .'] * 3 + ['k . h . s . h . k . s . s s s s'] +
        ['k . h k s . h . k . h k s . h g'] * 7 + ['k . h . s . h . k . s . s . s s'] +
        ['k h h k s h h k k h h k s h h o'] * 7 + ['k . k . s . s . k k s s s s s s'] +
        ['k . h k s . h . k . h k s . h g'] * 7 + ['k . h . s . h . k . s . s s s s']
    ),
}


def build(song):
    n_bars = len(song['lead'])
    for key in ('arp_style', 'bass_style', 'drums'):
        if len(song[key]) != n_bars:
            raise SystemExit(f'{key}: {len(song[key])} bars, lead has {n_bars}')
    prog = song['prog']

    lead = melodic_events(song['lead'])

    arp_bars, arp_macro = [], []
    for b, style in enumerate(song['arp_style']):
        root, q = prog[b % 4]
        root_up = name(midi(root) + 12 * song['arp_root_oct'])
        if style == 'pad':
            arp_bars.append(pad_bar(root_up, q))
            arp_macro += [pad_arp(q)] * 16
        else:
            arp_bars.append(arp_bar(root_up, q, style))
            arp_macro += [None] * 16
    arp = melodic_events(arp_bars)

    bass = melodic_events([bass_bar(prog[b % 4][0], s) for b, s in enumerate(song['bass_style'])])
    drums = []
    for bar in song['drums']:
        drums += parse_drums(bar)
    return lead, arp, arp_macro, bass, drums, n_bars


def render(song_id):
    song = SONGS[song_id]
    lead, arp, arp_macro, bass, drums, n_bars = build(song)
    steps = n_bars * 16
    passes = 3
    starts = step_frames(song['bpm'], steps * passes)
    total = starts[-1]

    lf, lv, ld = render_melodic(lead * passes, starts, total, song['lead_instr'])
    arp_instr = [('pad' if m else 'pluck') for m in arp_macro]
    # pulse 2 switches instrument per bar (pad chords vs plucked arps), so it
    # is rendered in two passes and merged by bar
    pf_pad, pv_pad, _ = render_melodic(arp * passes, starts, total, 'pad', arp=arp_macro * passes)
    pf_plk, pv_plk, _ = render_melodic(arp * passes, starts, total, 'pluck')
    use_pad = np.zeros(total, dtype=bool)
    for i, ins in enumerate(arp_instr * passes):
        if ins == 'pad':
            use_pad[starts[i]:starts[i + 1]] = True
    af = np.where(use_pad, pf_pad, pf_plk)
    av = np.where(use_pad, pv_pad, pv_plk)
    duty2 = np.where(use_pad, INSTR['pad']['duty'], INSTR['pluck']['duty'])

    tf, ton = render_triangle(bass * passes, starts, total)
    npf, nsf, nvf = render_noise(drums * passes, starts, total)

    p1 = synth_pulse(lf, lv, ld)
    # duty for pulse 2 can change per bar; both duties are rendered and picked
    p2a = synth_pulse(af, av, INSTR['pad']['duty'])
    p2b = synth_pulse(af, av, INSTR['pluck']['duty'])
    p2 = np.where(frames_to_samples(use_pad.astype(float)) > 0.5, p2a, p2b)
    tri = synth_triangle(tf, ton)
    noi = synth_noise(npf, nsf, nvf)

    mix = nes_mix(p1, p2, tri, noi)

    # Keep the middle pass. Only it (plus a second of filter warm-up before
    # it and the crossfade tail after) needs filtering.
    a, b = starts[steps] * FRAME, starts[2 * steps] * FRAME
    xf = int(SR * 0.025)
    region = mix[a - SR:b + xf]
    region = one_pole_hp(region, 37.0)          # the console's DC-blocking stage
    region = one_pole_lp(region, 14000.0)       # and its gentle top-end roll-off
    seg = region[SR:SR + (b - a)].copy()
    tail = region[SR + (b - a):]
    # crossfade the third pass's opening into the start, so the file ends
    # exactly where it begins
    w = np.linspace(0, 1, xf)
    seg[:xf] = w * seg[:xf] + (1 - w) * tail[:xf]
    return seg, song['bpm'], n_bars


def write_wav(path, x):
    x = x / max(1e-9, np.max(np.abs(x))) * 0.8
    pcm = (x * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def integrated_lufs(path):
    r = subprocess.run([ffmpeg(), '-hide_banner', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'],
                       capture_output=True, text=True)
    lines = [l for l in r.stderr.splitlines() if l.strip().startswith('I:')]
    return float(lines[-1].split()[1])


def main():
    wanted = [a for a in sys.argv[1:] if a in SONGS] or list(SONGS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for sid in wanted:
            seg, bpm, bars = render(sid)
            wav = Path(tmp) / f'{sid}.wav'
            write_wav(wav, seg)
            gain = TARGET_LUFS - integrated_lufs(wav)
            dst = OUT_DIR / f'{sid}.mp3'
            subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', str(wav),
                            '-af', f'volume={gain:.2f}dB', '-ac', '2', '-ar', str(SR),
                            '-c:a', 'libmp3lame', '-b:a', BITRATE, '-write_xing', '1',
                            '-metadata', 'title=' + sid, '-metadata', 'artist=Tally Wall',
                            '-metadata', 'comment=Composed for Tally Wall; rendered by scripts/compose-neon-music.py',
                            str(dst)], check=True)
            print(f'{sid:6} {bpm:>6} bpm  {bars} bars  {len(seg) / SR:5.1f}s  '
                  f'-> {dst.relative_to(ROOT)} ({dst.stat().st_size // 1024} kB, {integrated_lufs(dst):.1f} LUFS)')


if __name__ == '__main__':
    main()
