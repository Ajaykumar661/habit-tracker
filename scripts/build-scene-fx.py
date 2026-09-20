"""Slice the supplied effect sprite sheets into shippable assets + placements.

Tooling only — it crops, keys and repacks the sprites you supplied and picks
WHERE each one may appear; it never draws anything. Usage (from the repo root):
    python scripts/build-scene-fx.py [--preview <dir>]

Inputs
  art-src/fx-glow-sheet.png   black-background sheet: flames, stars, firefly,
                              shooting star, embers, motes, light shafts
  art-src/fx-solid-sheet.png  magenta-background sheet: clouds, mist, bat,
                              bird, butterflies, snoring Zs, breath puffs
  public/assets/environment/*-scene.png   to locate the sun/moon per scene

Outputs
  public/assets/fx/<name>.png   uniform-cell strips (one row per animation)
  public/assets/fx/static.png   atlas of the non-frame-animated sprites
  src/data/sceneFx.json         strip/atlas metadata + per-scene placements

Backgrounds are handled differently on purpose: the glow sheet is treated as
premultiplied-on-black (alpha = luminance, colour un-premultiplied), which is
what makes flames and stars composite without a dark fringe. The solid sheet
is chroma-keyed like the room art.
"""
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GLOW_SHEET = ROOT / 'art-src' / 'fx-glow-sheet.png'
SOLID_SHEET = ROOT / 'art-src' / 'fx-solid-sheet.png'
OUT_DIR = ROOT / 'public/assets/fx'
MANIFEST = ROOT / 'src/data/sceneFx.json'

SHRINK = 0.5          # sheets are ~2x the largest size anything is drawn at
GLOW_FLOOR = 10       # luminance at/below this is background
MIN_ALPHA = 0.05      # below this, un-premultiplying just amplifies noise

# ---------------------------------------------------------------------------
# Sheet layout, measured off the 1536x1024 sheets with projection profiles.
# ---------------------------------------------------------------------------
FLAME_COLS = [(78, 132), (211, 265), (343, 398), (476, 530), (609, 663), (742, 796),
              (874, 929), (1007, 1061), (1140, 1195), (1273, 1327), (1405, 1460)]
# Flames are drawn sitting in a brazier; only the flame is wanted, so each cell
# is cut just above the brazier's top rail (measured, see the row comments).
GLOW_ROWS = {
    'flame-night': {'y': (23, 157), 'cols': FLAME_COLS, 'cut': 92},
    'flame-dusk':  {'y': (188, 325), 'cols': FLAME_COLS, 'cut': 94},
}
STAR_ROW_Y = (368, 445)
STAR_COLS = [(113, 133), (205, 247), (297, 370), (427, 457),        # warm
             (606, 626), (696, 737), (785, 856), (912, 947),        # blue
             (1085, 1104), (1179, 1221), (1269, 1342), (1399, 1430)]  # pink
FIREFLY_ROW_Y = (480, 566)
FIREFLY_COLS = [(128, 229), (316, 426), (505, 608), (694, 794)]
FGLOW_COLS = [(949, 982), (1062, 1115), (1203, 1271)]
SHOOT_ROW_Y = (602, 683)
SHOOT_COLS = [(101, 272), (338, 498), (579, 719), (810, 931), (1028, 1122)]
EMBER_ROW_Y = (717, 837)
EMBER_GROUPS = [[(114, 132), (205, 234), (321, 353)],
                [(558, 586), (659, 694), (774, 818)],
                [(999, 1025), (1085, 1121), (1175, 1215)]]
MOTE_ROW_Y = (842, 995)
MOTE_COLS = [(101, 132), (204, 248), (401, 422), (487, 536), (695, 731), (804, 855)]
SHAFT_COLS = [(993, 1140), (1170, 1305), (1334, 1465)]

SOLID_ROWS = {
    'cloud-night': {'y': (60, 183), 'cols': [(30, 455), (496, 974), (1012, 1507)]},
    'cloud-dusk':  {'y': (250, 371), 'cols': [(29, 355), (396, 721), (755, 1056)]},
    'cloud-day':   {'y': (419, 554), 'cols': [(40, 355), (389, 721), (768, 1076)]},
    'mist':        {'y': (419, 554), 'cols': [(1112, 1283), (1314, 1488)]},
    'zzz':         {'y': (808, 929), 'cols': [(271, 319), (401, 469), (571, 673)]},
    'puff':        {'y': (808, 929), 'cols': [(860, 899), (987, 1048), (1142, 1224)]},
}
BAT_ROW_Y = (250, 371)
BAT_SPAN = (1110, 1505)     # four frames, split by gaps below
BIRD_ROW_Y = (628, 726)
BIRD_COLS = [(49, 134), (149, 234), (255, 339), (350, 432), (446, 525)]
BFLY_ORANGE = [(602, 691), (710, 793), (815, 894), (912, 1002)]
BFLY_BLUE = [(1079, 1172), (1190, 1274), (1295, 1377), (1396, 1498)]


# ------------------------------------------------------------------ keying --
def glow_rgba(rgb):
    """Black-background glow art -> straight alpha (un-premultiplied)."""
    f = rgb.astype(np.float64)
    lum = f.max(axis=2)
    a = np.clip((lum - GLOW_FLOOR) / (255.0 - GLOW_FLOOR), 0, 1)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    keep = a >= MIN_ALPHA
    safe = np.where(keep, a, 1.0)[..., None]
    out[..., :3] = np.clip(f / safe, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(keep, (a * 255).round(), 0).astype(np.uint8)
    out[~keep] = 0
    return out


def solid_rgba(rgb):
    """Magenta-keyed art -> hard alpha, with the key's spill removed."""
    f = rgb.astype(np.float64)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    # magenta-ness: how much both red and blue outrun green
    m = np.minimum(r, b) - g
    a = np.clip((150 - m) / 110.0, 0, 1)          # m>=150 out, m<=40 kept
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    keep = a > 0.02
    safe = np.where(keep, a, 1.0)[..., None]
    key = np.array([236.0, 20.0, 240.0])
    out[..., :3] = np.clip((f - (1 - safe) * key) / safe, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(keep, (a * 255).round(), 0).astype(np.uint8)
    out[~keep] = 0
    return out


def tight(rgba, thresh=6):
    ys, xs = np.nonzero(rgba[..., 3] > thresh)
    if len(ys) == 0:
        return rgba[:1, :1]
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def shrink(rgba, factor=SHRINK):
    im = Image.fromarray(rgba).convert('RGBa')
    size = (max(1, round(im.width * factor)), max(1, round(im.height * factor)))
    return np.array(im.resize(size, Image.LANCZOS).convert('RGBA'))


def split_by_gap(mask_cols, x0, x1, gap=8):
    """Column runs inside [x0,x1) separated by >=gap empty columns."""
    idx = [x for x in range(x0, x1) if mask_cols[x]]
    runs, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > gap:
            runs.append((s, p + 1))
            s = i
        p = i
    runs.append((s, p + 1))
    return runs


# ------------------------------------------------------------------ strips --
def make_strip(frames, name, align='bottom'):
    """Pack frames into one row of uniform cells, keeping a common anchor."""
    frames = [shrink(f) for f in frames]
    cw = max(f.shape[1] for f in frames) + 2
    ch = max(f.shape[0] for f in frames) + 2
    strip = np.zeros((ch, cw * len(frames), 4), np.uint8)
    for i, f in enumerate(frames):
        h, w = f.shape[:2]
        ox = i * cw + (cw - w) // 2
        oy = ch - h - 1 if align == 'bottom' else (ch - h) // 2
        strip[oy:oy + h, ox:ox + w] = f
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(strip).save(OUT_DIR / f'{name}.png')
    return {'src': f'/assets/fx/{name}.png', 'frames': len(frames), 'cw': cw, 'ch': ch}


def pack_static(items, max_w=1024, pad=2):
    names = sorted(items, key=lambda k: -items[k].shape[0])
    x = y = shelf = 0
    rects = {}
    for n in names:
        h, w = items[n].shape[:2]
        if x + w > max_w:
            x, y, shelf = 0, y + shelf + pad, 0
        rects[n] = (x, y, w, h)
        x += w + pad
        shelf = max(shelf, h)
    atlas = np.zeros((y + shelf, max_w, 4), np.uint8)
    for n, (rx, ry, w, h) in rects.items():
        atlas[ry:ry + h, rx:rx + w] = items[n]
    used = max(r[0] + r[2] for r in rects.values())
    atlas = atlas[:, :used]
    Image.fromarray(atlas).save(OUT_DIR / 'static.png')
    return {'src': '/assets/fx/static.png', 'atlas': [atlas.shape[1], atlas.shape[0]],
            'rects': {n: list(map(int, r)) for n, r in rects.items()}}


# --------------------------------------------------------------- geometry ---
# Measured per frame, in that room image's own pixel grid. The arch opening and
# the props sit in the same place in every time-of-day variant of a frame, so
# these are per-frame, not per-env; only the sun/moon moves (found per image).
FRAMES = {
    'landscape': {
        'scene': 'night-scene.png',           # any variant: geometry is shared
        'size': (1672, 941),
        'wall': (514, 199, 1217, 670),
        # the routines panel sits over the top of this window on desktop, so
        # the band that is actually *seen* starts lower than the arch does
        'sky_hi': (14, 110, 250, 330),
        'sky_lo': (14, 110, 250, 330),
        'vista': [(22, 386, 248, 500)],       # lake, trees, rooftops
        'air': [(268, 300, 500, 640), (1240, 300, 1610, 640)],   # room, clear of the wall
        'shafts': [(70, 120, 300, 470)],
        'lanterns': [(466, 367, 44), (1334, 367, 44), (47, 598, 42)],
        'cat': (1558, 606),
        'scale': 1.0,
    },
    'portrait': {
        'scene': 'mobile-night-scene.png',
        'size': (941, 1672),
        'wall': (225, 463, 713, 1192),
        'sky_hi': (298, 96, 650, 330),
        'sky_lo': (298, 96, 650, 330),
        'vista': [(296, 300, 632, 420)],
        'air': [(36, 760, 210, 1140), (730, 760, 906, 1140)],
        'shafts': [],                         # no room either side of the wall
        'lanterns': [(102, 772, 58), (837, 772, 58), (50, 1203, 50)],
        'cat': (748, 1208),
        'scale': 1.45,                        # sky window is bigger in this frame
    },
}

# Which effects each time of day gets. Counts are for the landscape frame and
# scale with the frame's `scale`. Lanterns are unlit in the day art, so no
# flames then.
ENV_FX = {
    'dawn': {'flame': 'flame-dusk', 'cloud': 'cloud-day', 'clouds': 2, 'mist': 2,
             'birds': 2, 'stars': 6, 'motes': 5, 'shafts': 1},
    'day':  {'flame': None, 'cloud': 'cloud-day', 'clouds': 3, 'birds': 3,
             'butterflies': 3, 'motes': 8, 'shafts': 2},
    'dusk': {'flame': 'flame-dusk', 'cloud': 'cloud-dusk', 'clouds': 3, 'bats': 3,
             'embers': 6, 'motes': 4, 'fglow': 3},
    'night': {'flame': 'flame-night', 'cloud': 'cloud-night', 'clouds': 2, 'stars': 26,
              'fireflies': 8, 'fglow': 4, 'shoot': 1},
}
# Which scene images actually exist (landscape has no dawn art; dawn reuses the
# dusk room there, so it also reuses the dusk placements).
SCENES = {
    'landscape': ['day', 'dusk', 'night'],
    'portrait': ['dawn', 'day', 'dusk', 'night'],
}


def sky_mask(img, zone):
    """Which pixels inside a zone are actually open sky.

    Hand-drawn rectangles don't know about the ivy hanging into the arch or
    the castle on the skyline, and a star pasted onto either reads as a bug.
    Open sky is the part that is smooth (low local variance — masonry, foliage
    and rooftops are all busy) and not green-dominant (that's ivy).
    """
    x0, y0, x1, y1 = zone
    sub = img[y0:y1, x0:x1, :3].astype(np.float64)
    lum = sub.mean(axis=2)
    k = 3
    pad = np.pad(lum, k, mode='edge')
    pad2 = pad * pad
    def boxsum(a):
        c = np.pad(a.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
        n = 2 * k + 1
        return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n])[:lum.shape[0], :lum.shape[1]]
    n = (2 * k + 1) ** 2
    mean = boxsum(pad) / n
    var = np.maximum(boxsum(pad2) / n - mean * mean, 0)
    smooth = var < 260
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
    not_ivy = ~((g > r + 5) & (g > b + 5))
    return smooth & not_ivy


def coverage(mask, zone, box):
    """Share of a box that is sky, in the mask's own (zone-relative) frame."""
    zx0, zy0, zx1, zy1 = zone
    x0 = int(max(0, box[0] - zx0)); y0 = int(max(0, box[1] - zy0))
    x1 = int(min(zx1 - zx0, box[2] - zx0)); y1 = int(min(zy1 - zy0, box[3] - zy0))
    if x1 <= x0 or y1 <= y0:
        return 0.0
    if box[0] < zx0 or box[1] < zy0 or box[2] > zx1 or box[3] > zy1:
        return 0.0
    return float(mask[y0:y1, x0:x1].mean())


def celestial_keepout(img, zone, radius):
    """Where the sun/moon sits in the sky zone.

    A percentile threshold is no good here: a daytime sky is bright all over,
    so it selects the whole zone. The disc is instead the brightest *local
    area*, found by box-averaging the luminance and taking the peak.
    """
    x0, y0, x1, y1 = zone
    lum = img[y0:y1, x0:x1, :3].astype(np.float64).sum(axis=2)
    k = max(6, int(radius * 0.7))
    pad = np.pad(lum, k, mode='edge')
    csum = pad.cumsum(0).cumsum(1)
    csum = np.pad(csum, ((1, 0), (1, 0)))
    n = 2 * k
    box = (csum[n:, n:] - csum[:-n, n:] - csum[n:, :-n] + csum[:-n, :-n])
    box = box[:lum.shape[0], :lum.shape[1]]
    iy, ix = np.unravel_index(int(box.argmax()), box.shape)
    cx, cy = x0 + ix, y0 + iy
    return (cx - radius, cy - radius, cx + radius, cy + radius)


def overlaps(box, rects):
    ax0, ay0, ax1, ay1 = box
    for bx0, by0, bx1, by1 in rects:
        if ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1:
            return True
    return False


class Placer:
    """Picks non-overlapping spots inside zones, keeping clear of keep-outs."""

    def __init__(self, rng, keepout):
        self.rng = rng
        self.keepout = list(keepout)
        self.taken = []

    def put(self, zones, w, h, pad=4, tries=900, mask=None, zone=None, cover=0.9):
        for _ in range(tries):
            zx0, zy0, zx1, zy1 = self.rng.choice(zones)
            if zx1 - zx0 < w or zy1 - zy0 < h:
                continue
            x = self.rng.uniform(zx0 + w / 2, zx1 - w / 2)
            y = self.rng.uniform(zy0 + h / 2, zy1 - h / 2)
            box = (x - w / 2 - pad, y - h / 2 - pad, x + w / 2 + pad, y + h / 2 + pad)
            if overlaps(box, self.keepout) or overlaps(box, self.taken):
                continue
            if mask is not None and coverage(mask, zone, box) < cover:
                continue
            self.taken.append(box)
            return round(x, 1), round(y, 1)
        return None


def main():
    preview = None
    if '--preview' in sys.argv:
        preview = Path(sys.argv[sys.argv.index('--preview') + 1])

    glow = glow_rgba(np.array(Image.open(GLOW_SHEET).convert('RGB')))
    solid = solid_rgba(np.array(Image.open(SOLID_SHEET).convert('RGB')))
    manifest = {'strips': {}, 'static': None, 'placements': {}}

    # ---- strips -----------------------------------------------------------
    for name, cfg in GLOW_ROWS.items():
        y0, _ = cfg['y']
        frames = [tight(glow[y0:y0 + cfg['cut'], c0:c1]) for c0, c1 in cfg['cols']]
        manifest['strips'][name] = make_strip(frames, name, align='bottom')

    sy0, sy1 = STAR_ROW_Y
    for i, tone in enumerate(('warm', 'blue', 'pink')):
        cols = STAR_COLS[i * 4:(i + 1) * 4]
        manifest['strips'][f'star-{tone}'] = make_strip(
            [tight(glow[sy0:sy1, c0:c1]) for c0, c1 in cols], f'star-{tone}', 'center')

    fy0, fy1 = FIREFLY_ROW_Y
    manifest['strips']['firefly'] = make_strip(
        [tight(glow[fy0:fy1, c0:c1]) for c0, c1 in FIREFLY_COLS], 'firefly', 'center')

    hy0, hy1 = SHOOT_ROW_Y
    manifest['strips']['shoot'] = make_strip(
        [tight(glow[hy0:hy1, c0:c1]) for c0, c1 in SHOOT_COLS], 'shoot', 'center')

    ey0, ey1 = EMBER_ROW_Y
    for i, grp in enumerate(EMBER_GROUPS):
        manifest['strips'][f'ember-{i}'] = make_strip(
            [tight(glow[ey0:ey1, c0:c1]) for c0, c1 in grp], f'ember-{i}', 'bottom')

    by0, by1 = BAT_ROW_Y
    bat_mask = solid[by0:by1, :, 3].max(axis=0) > 8
    bat_cols = split_by_gap(bat_mask, *BAT_SPAN, gap=6)
    if len(bat_cols) != 4:
        raise SystemExit(f'expected 4 bat frames, found {len(bat_cols)}: {bat_cols}')
    manifest['strips']['bat'] = make_strip(
        [tight(solid[by0:by1, c0:c1]) for c0, c1 in bat_cols], 'bat', 'center')

    ry0, ry1 = BIRD_ROW_Y
    manifest['strips']['bird'] = make_strip(
        [tight(solid[ry0:ry1, c0:c1]) for c0, c1 in BIRD_COLS], 'bird', 'center')
    for tone, cols in (('orange', BFLY_ORANGE), ('blue', BFLY_BLUE)):
        manifest['strips'][f'butterfly-{tone}'] = make_strip(
            [tight(solid[ry0:ry1, c0:c1]) for c0, c1 in cols], f'butterfly-{tone}', 'center')

    # ---- static atlas -----------------------------------------------------
    statics = {}
    for name, cfg in SOLID_ROWS.items():
        y0, y1 = cfg['y']
        for i, (c0, c1) in enumerate(cfg['cols']):
            statics[f'{name}-{i}'] = shrink(tight(solid[y0:y1, c0:c1]))
    for i, (c0, c1) in enumerate(FGLOW_COLS):
        statics[f'fglow-{i}'] = shrink(tight(glow[fy0:fy1, c0:c1]))
    my0, my1 = MOTE_ROW_Y
    for i, (c0, c1) in enumerate(MOTE_COLS[1::2]):      # the bright frame of each pair
        statics[f'mote-{i}'] = shrink(tight(glow[my0:my1, c0:c1]))
    for i, (c0, c1) in enumerate(SHAFT_COLS):
        statics[f'shaft-{i}'] = shrink(tight(glow[my0:my1, c0:c1]))
    manifest['static'] = pack_static(statics)

    print('strips:', ', '.join(f"{k}({v['frames']}@{v['cw']}x{v['ch']})"
                               for k, v in manifest['strips'].items()))
    print('static atlas:', manifest['static']['atlas'], len(statics), 'sprites')

    # ---- placements -------------------------------------------------------
    for frame, envs in SCENES.items():
        geo = FRAMES[frame]
        S = geo['scale']
        W, H = geo['size']
        for env in envs:
            img_name = geo['scene'].replace('night', env) if env != 'night' else geo['scene']
            img = np.array(Image.open(ROOT / 'public/assets/environment' / img_name).convert('RGB'))
            rng = random.Random(f'tally-wall-fx-{frame}-{env}')
            recipe = ENV_FX[env]
            keep = [geo['wall']]
            keep.append(celestial_keepout(img, geo['sky_hi'], round(30 * S)))
            p = Placer(rng, keep)
            sky = sky_mask(img, geo['sky_hi'])
            skyz = geo['sky_hi']
            out = {}

            def sized(base):
                return round(base * S)

            # clouds drift, so reserve room either side of where they sit
            cl = []
            for _ in range(recipe.get('clouds', 0)):
                w = sized(rng.uniform(62, 92))
                spot = p.put([geo['sky_hi']], w * 1.5, w * 0.42, mask=sky, zone=skyz, cover=0.7)
                if spot:
                    cl.append({'s': f"{recipe['cloud']}-{rng.randrange(3)}", 'x': spot[0], 'y': spot[1],
                               'w': w, 'dur': round(rng.uniform(58, 96), 1),
                               'delay': round(-rng.uniform(0, 60), 1),
                               'op': round(rng.uniform(0.45, 0.72), 2)})
            out['clouds'] = cl

            out['stars'] = [
                {'k': rng.choice(['warm', 'blue', 'pink']), 'x': s[0], 'y': s[1], 'w': w,
                 'dur': round(rng.uniform(2.6, 6.2), 2), 'delay': round(-rng.uniform(0, 6.2), 2)}
                for w, s in ((w, p.put([geo['sky_hi']], w, w, mask=sky, zone=skyz))
                             for w in (sized(rng.choice([7, 9, 12, 16, 22])) for _ in range(recipe.get('stars', 0))))
                if s]

            out['fireflies'] = [
                {'x': s[0], 'y': s[1], 'w': sized(rng.uniform(12, 18)), 'path': rng.randrange(3),
                 'dur': round(rng.uniform(12, 19), 1), 'blink': round(rng.uniform(3.2, 6.4), 2),
                 'delay': round(-rng.uniform(0, 12), 2)}
                for s in (p.put(geo['vista'], sized(20), sized(20)) for _ in range(recipe.get('fireflies', 0)))
                if s]

            out['fglow'] = [
                {'s': f'fglow-{rng.randrange(3)}', 'x': s[0], 'y': s[1], 'w': sized(rng.uniform(6, 10)),
                 'blink': round(rng.uniform(2.6, 5.5), 2), 'delay': round(-rng.uniform(0, 5), 2)}
                for s in (p.put(geo['vista'], sized(12), sized(12)) for _ in range(recipe.get('fglow', 0)))
                if s]

            out['motes'] = [
                {'s': f'mote-{rng.randrange(3)}', 'x': s[0], 'y': s[1], 'w': sized(rng.uniform(5, 9)),
                 'dur': round(rng.uniform(16, 27), 1), 'path': rng.randrange(3),
                 'delay': round(-rng.uniform(0, 20), 1)}
                for s in (p.put(geo['air'], sized(14), sized(14)) for _ in range(recipe.get('motes', 0)))
                if s]

            # travellers cross the sky: store a start point and a travel span.
            # They avoid each other's lanes, but may pass in front of clouds.
            runs = []
            def travellers(n, strip, w_base, zone, dur, mask=None, mzone=None):
                """Find a clear corridor for something that flies across.

                The whole width of the window is never clear — the castle is
                in the way — so each traveller gets a shorter run and we look
                for somewhere it can cross without passing through masonry.
                """
                items = []
                zx0, zy0, zx1, zy1 = zone
                for _ in range(n * 60):
                    if len(items) >= n:
                        break
                    w = sized(w_base)
                    span = (zx1 - zx0) * rng.uniform(0.3, 0.55)
                    if zx1 - zx0 < span + w * 2 or zy1 - zy0 < w * 2:
                        continue
                    x0 = rng.uniform(zx0 + w / 2, zx1 - w / 2 - span)
                    y = rng.uniform(zy0 + w * 0.8, zy1 - w * 0.8)
                    run = (x0 - w / 2, y - w * 0.6, x0 + span + w / 2, y + w * 0.6)
                    if overlaps(run, runs):
                        continue
                    if mask is not None:
                        steps = [x0 + span * t / 6 for t in range(7)]
                        if min(coverage(mask, mzone, (sx - w / 2, y - w / 2, sx + w / 2, y + w / 2))
                               for sx in steps) < 0.8:
                            continue
                    runs.append(run)
                    items.append({'k': strip, 'x': round(x0, 1), 'y': round(y, 1), 'w': w,
                                  'span': round(span, 1), 'dur': round(rng.uniform(*dur), 1),
                                  'delay': round(-rng.uniform(0, dur[1]), 1),
                                  'flip': rng.random() < 0.5})
                return items

            out['birds'] = travellers(recipe.get('birds', 0), 'bird', 15, geo['sky_lo'], (17, 29), sky, skyz)
            out['bats'] = travellers(recipe.get('bats', 0), 'bat', 14, geo['sky_hi'], (13, 22), sky, skyz)
            out['butterflies'] = []
            for _ in range(recipe.get('butterflies', 0)):
                out['butterflies'] += travellers(1, f'butterfly-{rng.choice(["orange", "blue"])}',
                                                 12, geo['vista'][0], (19, 31))

            out['mist'] = [
                {'s': f'mist-{rng.randrange(2)}', 'x': s[0], 'y': s[1], 'w': sized(rng.uniform(70, 100)),
                 'dur': round(rng.uniform(40, 70), 1), 'delay': round(-rng.uniform(0, 40), 1)}
                for s in (p.put(geo['vista'], sized(90), sized(26)) for _ in range(recipe.get('mist', 0)))
                if s]

            out['shafts'] = [
                {'s': f'shaft-{i % 3}', 'x': round(z[0] + (i + 1) * (z[2] - z[0]) / (recipe.get('shafts', 1) + 1), 1),
                 'y': round((z[1] + z[3]) / 2, 1), 'w': sized(rng.uniform(80, 110)),
                 'dur': round(rng.uniform(9, 15), 1), 'delay': round(-rng.uniform(0, 9), 1)}
                for i, z in ((i, geo['shafts'][0]) for i in range(recipe.get('shafts', 0) if geo['shafts'] else 0))]

            # embers rise out of the lit lanterns
            out['embers'] = []
            if recipe.get('embers') and recipe.get('flame'):
                for i in range(recipe['embers']):
                    lx, ly, lw = geo['lanterns'][i % len(geo['lanterns'])]
                    out['embers'].append({
                        'k': f'ember-{rng.randrange(3)}',
                        'x': round(lx + rng.uniform(-lw * 0.3, lw * 0.3), 1),
                        'y': round(ly - lw * 0.45, 1), 'w': sized(rng.uniform(7, 12)),
                        'dur': round(rng.uniform(3.4, 6.0), 2),
                        'delay': round(-rng.uniform(0, 6), 2),
                        'rise': round(rng.uniform(34, 62) * S, 1)})

            out['shoot'] = []
            for _ in range(recipe.get('shoot', 0)):
                zx0, zy0, zx1, zy1 = geo['sky_hi']
                w = sized(46)
                if zx1 - zx0 > w * 2.6:
                    out['shoot'].append({
                        'x': round(rng.uniform(zx0 + w * 0.6, zx1 - w * 1.5), 1),
                        'y': round(rng.uniform(zy0 + 8, zy0 + (zy1 - zy0) * 0.4), 1),
                        'w': w,
                        'dx': round(rng.uniform(0.8, 1.2) * w, 1),
                        'dy': round(rng.uniform(0.25, 0.5) * w, 1),
                        'dur': round(rng.uniform(21, 34), 1),
                        'delay': round(-rng.uniform(0, 18), 1)})

            out['flames'] = ([{'k': recipe['flame'], 'x': lx, 'y': ly, 'w': lw}
                              for lx, ly, lw in geo['lanterns']] if recipe.get('flame') else [])

            cx, cy = geo['cat']
            out['zzz'] = [{'s': f'zzz-{i}', 'x': cx, 'y': cy, 'w': sized(13 + i * 5),
                           'dur': 5.4, 'delay': round(-i * 1.8, 2),
                           'rise': round(70 * S, 1)} for i in range(3)]

            # nothing may cover the tally wall
            wx0, wy0, wx1, wy1 = geo['wall']
            for kind, items in out.items():
                for it in items:
                    half = it.get('w', 0) / 2
                    if overlaps((it['x'] - half, it['y'] - half, it['x'] + half, it['y'] + half),
                                [geo['wall']]):
                        raise SystemExit(f'{frame}/{env}: {kind} at {it["x"]},{it["y"]} overlaps the wall')

            manifest['placements'][f'{frame}-{env}'] = out
            counts = {k: len(v) for k, v in out.items() if v}
            print(f'  {frame}-{env}: {counts}')

            if preview:
                preview.mkdir(parents=True, exist_ok=True)
                render_preview(img, out, manifest, preview / f'preview-{frame}-{env}.png')

    MANIFEST.write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
    print('wrote', MANIFEST.relative_to(ROOT), f'({MANIFEST.stat().st_size // 1024} kB)')


def render_preview(scene_rgb, placements, manifest, path):
    """Rough composite: first frame of each animation, at its resting spot."""
    canvas = Image.fromarray(scene_rgb).convert('RGBA')
    atlas = Image.open(OUT_DIR / 'static.png').convert('RGBA')
    strips = {k: Image.open(ROOT / 'public' / v['src'].lstrip('/')).convert('RGBA')
              for k, v in manifest['strips'].items()}

    def paste(sp, x, y, w, op=1.0):
        if sp.width == 0 or sp.height == 0:
            return
        h = max(1, round(w * sp.height / sp.width))
        sp = sp.resize((max(1, round(w)), h), Image.LANCZOS)
        if op < 1:
            al = sp.getchannel('A').point(lambda v: int(v * op))
            sp.putalpha(al)
        canvas.alpha_composite(sp, (round(x - sp.width / 2), round(y - sp.height / 2)))

    def static_sprite(name):
        rx, ry, rw, rh = manifest['static']['rects'][name]
        return atlas.crop((rx, ry, rx + rw, ry + rh))

    def strip_frame(name, i=0):
        s = manifest['strips'][name]
        im = strips[name]
        return im.crop((i * s['cw'], 0, (i + 1) * s['cw'], s['ch']))

    for it in placements.get('shafts', []):
        paste(static_sprite(it['s']), it['x'], it['y'], it['w'], 0.5)
    for key in ('clouds', 'mist'):
        for it in placements.get(key, []):
            paste(static_sprite(it['s']), it['x'], it['y'], it['w'], it.get('op', 0.8))
    for it in placements.get('stars', []):
        paste(strip_frame(f"star-{it['k']}", 2), it['x'], it['y'], it['w'])
    for key in ('fglow', 'motes'):
        for it in placements.get(key, []):
            paste(static_sprite(it['s']), it['x'], it['y'], it['w'])
    for it in placements.get('fireflies', []):
        paste(strip_frame('firefly', 0), it['x'], it['y'], it['w'])
    for key, idx in (('birds', 1), ('bats', 1), ('butterflies', 1)):
        for it in placements.get(key, []):
            paste(strip_frame(it['k'], idx), it['x'] + it['span'] / 2, it['y'], it['w'])
    for it in placements.get('embers', []):
        paste(strip_frame(it['k'], 1), it['x'], it['y'] - it['rise'] / 2, it['w'])
    for it in placements.get('flames', []):
        s = manifest['strips'][it['k']]
        sp = strip_frame(it['k'], 3)
        h = round(it['w'] * s['ch'] / s['cw'])
        sp = sp.resize((it['w'], h), Image.LANCZOS)
        canvas.alpha_composite(sp, (round(it['x'] - it['w'] / 2), round(it['y'] + 2 - h)))
    for it in placements.get('zzz', []):
        paste(static_sprite(it['s']), it['x'] + it['w'] * 0.6, it['y'] - it['rise'] * 0.5, it['w'])
    canvas.convert('RGB').save(path)


if __name__ == '__main__':
    main()
