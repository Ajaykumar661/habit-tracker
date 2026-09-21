"""Cut the "living room" sheets into sprites: milestone objects, the cat's
upgrades, petting the cat, and the seasons.

    python scripts/build-extras.py --theme medieval|neon

Reads art-src/<theme>/<theme>_*.png (all keyed on pure green), writes
public/assets/themes/<theme>/extras/*.png and src/data/themes/<theme>/extras.json.

Every sheet goes through sheet_slicer.layout(), which checks the sprite count
per row against what the sheet was asked for, so a sheet that came back wrong
stops the build instead of slicing into nonsense.

Scale: the scene's own sleeping cat (fx/cat.png) is the ruler. Anything drawn
in place of her -- the petting frames, her cushion or pod -- records `rel`,
its cell width as a multiple of the sleeping cat's cell width, so she comes
out exactly her usual size. Room objects are placed by width in the scene, so
they need no ruler.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sheet_slicer import blobs, layout  # noqa: E402

# build-scene-fx.py has a hyphen in its name, so it is loaded by path.
_spec = importlib.util.spec_from_file_location('scene_fx', ROOT / 'scripts/build-scene-fx.py')
fx = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fx)
green_rgba, tight, shrink = fx.green_rgba, fx.tight, fx.shrink

MILESTONE_DAYS = [7, 14, 30, 60, 100, 365]
MILESTONE_IDS = {
    'medieval': ['candle', 'herb', 'goblet', 'banner', 'crown', 'armour'],
    'neon': ['lavalamp', 'holoplant', 'trophy', 'uptime', 'arcade', 'hologram'],
}
# Sheet names as saved. Two arrived under their own names; both are listed.
SHEETS = {
    'medieval': {
        'milestones': 'medieval_1_milestones.png',
        'flicker': 'medieval_candle.png',
        'upgrades': 'medieval_3_cat_upgrade.png',
        'pet': 'medieval_4_pet_cat.png',
        'particles': 'medieval_5_season_particles.png',
        'decorations': 'medieval_6_season_decorations_new.png',
        # her crown at 100, on the same cushion as her bed at 30
        'crown': 'Crowned Cat on Velvet Cushion.png',
    },
    'neon': {
        'milestones': 'neon_1_milestones.png',
        'flicker': 'neon_uptime.png',
        'upgrades': 'neon_cat_upgrade.png',
        'pet': 'neon_4_pet_cat.png',
        'particles': 'neon_5_season_particles.png',
        'decorations': 'neon_6_season_decorations.png',
    },
}
# The trophy shelf. Every milestone object has a fixed slot, earned or not
# (unearned ones show as silhouettes), laid out left to right in day order
# across the rows below. Each row: y = the line objects stand on, x0..x1 =
# its extent, h = the tallest an object may be, n = slots. `plank` rows get
# a wooden plank drawn under them; others stand on a surface already in the
# art (the lintel, the top of a wall). Every object is fitted into its slot
# at the same height, so the row reads as one collection.
SHELVES = {
    'medieval': {
        # hung inside the archway, above the lintel the cat sleeps on
        'portrait': [{'y': 336, 'x0': 266, 'x1': 668, 'h': 96, 'n': 6, 'plank': True}],
        # two planks on the pillar left of the wall, above the cat's stool
        'landscape': [
            {'y': 508, 'x0': 290, 'x1': 470, 'h': 78, 'n': 3, 'plank': True},
            {'y': 606, 'x0': 290, 'x1': 470, 'h': 80, 'n': 3, 'plank': True},
        ],
    },
    'neon': {
        # the top of the wall is the shelf
        'portrait': [{'y': 470, 'x0': 186, 'x1': 606, 'h': 100, 'n': 6}],
        'landscape': [{'y': 233, 'x0': 470, 'x1': 1230, 'h': 84, 'n': 6}],
    },
}


def plank_rgba(width, theme):
    """A pixel-art wooden plank with iron brackets under each end."""
    h = 22
    img = np.zeros((h, width, 4), np.uint8)
    wood = [(0x2a, 0x18, 0x0c), (0x9a, 0x66, 0x33), (0x7a, 0x4e, 0x26), (0x6a, 0x42, 0x20),
            (0x6a, 0x42, 0x20), (0x5c, 0x38, 0x1b), (0x5c, 0x38, 0x1b), (0x3e, 0x25, 0x12), (0x2a, 0x18, 0x0c)]
    for y, c in enumerate(wood):
        img[y, :, :3] = c
        img[y, :, 3] = 255
    for x in range(9, width - 9, 37):           # grain and board joints
        img[3:7, x, :3] = (0x4a, 0x2d, 0x15)
    for bx in (18, width - 26):                 # brackets
        for y in range(9, h):
            w = max(2, 10 - (y - 9) * 10 // (h - 9))
            img[y, bx:bx + w, :3] = (0x2c, 0x2a, 0x28)
            img[y, bx:bx + w, 3] = 255
            img[y, bx, :3] = (0x55, 0x50, 0x4a)
    return img


# Where each season's decoration goes (x centre, y bottom, w), per
# orientation. Only one season shows at a time, so they may share a spot.
# Medieval has none until its decoration sheet exists.
SEASON_SPOTS = {
    'neon': {
        'landscape': {
            # the gap on the wall top between the shelf and the right lamp
            'winter': (1262, 233, 70), 'autumn': (1262, 233, 56),
            'spring': (1262, 233, 64), 'summer': (1262, 233, 30),
        },
        # hung on the fire escape right of the shelf
        'portrait': {
            'winter': (802, 440, 96), 'autumn': (800, 440, 62),
            'spring': (800, 440, 90), 'summer': (802, 440, 36),
        },
    },
    'medieval': {
        # landscape: the open floor right of the action panel, in front of
        # the flower pot (the ledge at the wall's foot is part of the wall)
        'landscape': {
            'winter': (1186, 792, 62), 'autumn': (1182, 792, 84),
            'spring': (1182, 792, 80), 'summer': (1188, 792, 44),
        },
        # the left end of the lintel; the cat has the right
        'portrait': {
            'winter': (268, 440, 64), 'autumn': (270, 440, 80),
            'spring': (270, 440, 78), 'summer': (266, 440, 44),
        },
    },
}

# Which milestone objects have a flicker strip, in sheet row order.
FLICKERS = {'medieval': ['candle'], 'neon': ['uptime', 'lavalamp']}
SEASON_ROWS = ['spring', 'summer', 'autumn', 'winter']
DECORATIONS = {'neon': ['winter', 'autumn', 'spring', 'summer'],
               'medieval': ['winter', 'autumn', 'spring', 'summer']}


def load(path):
    return green_rgba(np.array(Image.open(path).convert('RGB')))


def crop(rgba, box):
    x0, y0, x1, y1 = box
    return tight(rgba[y0:y1, x0:x1])


class Out:
    def __init__(self, theme):
        self.dir = ROOT / 'public/assets/themes' / theme / 'extras'
        self.url = f'/assets/themes/{theme}/extras'
        self.dir.mkdir(parents=True, exist_ok=True)

    def sprite(self, rgba, name):
        img = shrink(rgba)
        Image.fromarray(img).save(self.dir / f'{name}.png')
        return {'src': f'{self.url}/{name}.png', 'w': img.shape[1], 'h': img.shape[0]}

    def strip(self, frames, name):
        """One row of equal cells, every frame bottom-aligned and centred."""
        frames = [shrink(f) for f in frames]
        cw = max(f.shape[1] for f in frames) + 2
        ch = max(f.shape[0] for f in frames) + 2
        out = np.zeros((ch, cw * len(frames), 4), np.uint8)
        for i, f in enumerate(frames):
            h, w = f.shape[:2]
            ox = i * cw + (cw - w) // 2
            out[ch - h - 1:ch - 1, ox:ox + w] = f
        Image.fromarray(out).save(self.dir / f'{name}.png')
        return {'src': f'{self.url}/{name}.png', 'frames': len(frames), 'cw': cw, 'ch': ch}


def body_width(rgba, seam=None):
    """Width of the solid body, ignoring faint glow and any ledge below `seam`."""
    a = rgba[..., 3]
    if seam is not None:
        a = a[:max(1, int(a.shape[0] * seam))]
    cols = np.nonzero((a > 128).sum(axis=0) > 2)[0]
    return int(cols.max() - cols.min() + 1) if len(cols) else 1


def scene_cat_body(theme):
    """The sleeping cat's body width and cell width, from the built fx strip."""
    info = json.loads((ROOT / f'src/data/themes/{theme}/sceneFx.json').read_text())['strips']['cat']
    strip = np.array(Image.open(ROOT / 'public' / info['src'].lstrip('/')).convert('RGBA'))
    frame0 = strip[:, :info['cw']]
    return body_width(frame0, info.get('seam')), info['cw']


def largest_single(rgba, region):
    """The biggest separate sprite inside `region` -- one petal out of a flurry."""
    x0, y0, x1, y1 = region
    sub = rgba[y0:y1, x0:x1]
    boxes = blobs(sub[..., 3], join=1, step=1)
    if not boxes:
        return None
    b = max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    return crop(sub, b)


def build(theme, preview=False):
    art = ROOT / 'art-src' / theme
    out = Out(theme)
    names = SHEETS[theme]
    manifest = {'milestones': [], 'cat': {}, 'seasons': {}}

    # ---- milestone objects, and the flicker strips that replace some -------
    sheet = load(art / names['milestones'])
    [row] = layout(sheet[..., 3], [6], names['milestones'])
    flick = {}
    fpath = art / names['flicker']
    if fpath.exists():
        fs = load(fpath)
        rows = layout(fs[..., 3], [4] * len(FLICKERS[theme]), names['flicker'])
        for obj, frames in zip(FLICKERS[theme], rows):
            flick[obj] = out.strip([crop(fs, b) for b in frames], f'm-{obj}-flicker')
    for day, obj, box in zip(MILESTONE_DAYS, MILESTONE_IDS[theme], row):
        item = {'id': obj, 'day': day, **out.sprite(crop(sheet, box), f'm-{obj}')}
        if obj in flick:
            item['flicker'] = flick[obj]
        manifest['milestones'].append(item)

    # ---- the shelf: a fixed slot for every object, fitted to one height ---
    manifest['shelves'] = {}
    for orient, rows in SHELVES[theme].items():
        slots = []
        for r in rows:
            sw = (r['x1'] - r['x0']) / r['n']
            slots += [(r, r['x0'] + sw * (k + 0.5), sw) for k in range(r['n'])]
        if len(slots) < len(manifest['milestones']):
            raise SystemExit(f'{theme}/{orient}: {len(slots)} shelf slots for {len(manifest["milestones"])} objects')
        for m, (r, cx, sw) in zip(manifest['milestones'], slots):
            iw, ih = (m['flicker']['cw'], m['flicker']['ch']) if 'flicker' in m else (m['w'], m['h'])
            w = min(sw * 0.86, r['h'] * iw / ih)
            m.setdefault('spots', {})[orient] = {'x': round(cx), 'y': r['y'], 'w': round(w)}
        planks = []
        for k, r in enumerate(rows):
            if r.get('plank'):
                width = r['x1'] - r['x0'] + 16
                Image.fromarray(plank_rgba(width, theme)).save(out.dir / f'shelf-{orient}-{k}.png')
                planks.append({'src': f'{out.url}/shelf-{orient}-{k}.png', 'x': r['x0'] - 8, 'y': r['y'] - 2,
                               'w': width, 'h': 22})
        manifest['shelves'][orient] = planks

    # ---- the cat: her ruler, then everything drawn in her place ------------
    cat_body, cat_cw = scene_cat_body(theme)

    pet = load(art / names['pet'])
    frames, hearts = layout(pet[..., 3], [8, 3], names['pet'])
    pet_frames = [crop(pet, b) for b in frames]
    strip = out.strip(pet_frames, 'cat-pet')
    # frame 0 is her asleep: its body is what must match the scene's cat
    body = body_width(shrink(pet_frames[0]))
    strip['rel'] = round((strip['cw'] / body) * (cat_body / cat_cw), 4)
    manifest['cat']['pet'] = strip
    manifest['cat']['heart'] = out.strip([crop(pet, b) for b in hearts], 'cat-heart')

    up = load(art / names['upgrades'])
    crown_path = art / names['crown'] if 'crown' in names else None
    [ups] = layout(up[..., 3], [2], names['upgrades'])
    for key, box, day in zip(['bed', 'crown'], ups, [30, 100]):
        img = crop(up, box)
        spr = out.sprite(img, f'cat-{key}')
        # measured on the cat alone: the top half, above any cushion or pod
        spr['rel'] = round((spr['w'] / body_width(shrink(img), 0.55)) * (cat_body / cat_cw), 4)
        spr['day'] = day
        manifest['cat'][key] = spr
    if crown_path and crown_path.exists():
        # a crowned cat on the bed's own cushion: drawn at the bed's scale,
        # so she does not change size between 30 days and 100
        cs = load(crown_path)
        [[box]] = layout(cs[..., 3], [1], names['crown'])
        spr = out.sprite(crop(cs, box), 'cat-crown')
        spr['rel'] = manifest['cat']['bed']['rel']
        spr['day'] = 100
        manifest['cat']['crown'] = spr

    # ---- seasons: one clean particle each, and a decoration -----------------
    ppath = art / names['particles']
    if ppath.exists():
        ps = load(ppath)
        h, w = ps.shape[:2]
        # Four rows, one per season, each with a label plate at the far left
        # and small frame numbers along the top: skip the plate's columns and
        # keep the biggest single sprite from the rest of the row.
        rows = np.array_split(np.arange(h), 4)
        label_end = int(w * 0.2)
        for season, ys in zip(SEASON_ROWS, rows):
            if season == 'summer':
                continue            # summer keeps the scene's own fireflies
            p = largest_single(ps, (label_end, ys[0], w, ys[-1] + 1))
            if p is not None:
                manifest['seasons'].setdefault(season, {})['particle'] = out.sprite(p, f'season-{season}')

    dpath = art / names['decorations']
    if dpath.exists():
        ds = load(dpath)
        [drow] = layout(ds[..., 3], [4], names['decorations'])
        for season, box in zip(DECORATIONS[theme], drow):
            deco = out.sprite(crop(ds, box), f'season-{season}-deco')
            deco['spots'] = {o: dict(zip('xyw', SEASON_SPOTS[theme][o][season]))
                             for o in SEASON_SPOTS[theme] if season in SEASON_SPOTS[theme][o]}
            manifest['seasons'].setdefault(season, {})['decoration'] = deco
    else:
        print(f'{theme}: no {names["decorations"]} yet -- seasons will have particles only')

    if preview:
        render_previews(theme, manifest)

    dest = ROOT / f'src/data/themes/{theme}/extras.json'
    dest.write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    print(f'{theme}: {len(manifest["milestones"])} milestones, cat {sorted(manifest["cat"])}, '
          f'seasons {sorted(manifest["seasons"])} -> {dest.relative_to(ROOT)}')


def render_previews(theme, manifest):
    """Every milestone drawn into each day room, for checking the spots by eye."""
    env = ROOT / 'public/assets/themes' / theme / 'environment'
    rooms = {'landscape': env / 'day-scene.png', 'portrait': env / 'mobile-day-scene.png'}
    out_dir = ROOT / '.preview'
    out_dir.mkdir(exist_ok=True)
    for orient, path in rooms.items():
        room = Image.open(path).convert('RGBA')
        for pl in manifest['shelves'].get(orient, []):
            img = Image.open(ROOT / 'public' / pl['src'].lstrip('/')).convert('RGBA')
            room.alpha_composite(img, (pl['x'], pl['y']))
        for m in manifest['milestones']:
            s = m['spots'][orient]
            img = Image.open(ROOT / 'public' / m['src'].lstrip('/')).convert('RGBA')
            h = round(img.height * s['w'] / img.width)
            img = img.resize((s['w'], h), Image.LANCZOS)
            room.alpha_composite(img, (round(s['x'] - s['w'] / 2), round(s['y'] - h)))
        for season in [manifest['seasons'].get('winter', {})]:
            d = season.get('decoration')
            if not d or orient not in d.get('spots', {}):
                continue
            s = d['spots'][orient]
            img = Image.open(ROOT / 'public' / d['src'].lstrip('/')).convert('RGBA')
            h = round(img.height * s['w'] / img.width)
            img = img.resize((s['w'], h), Image.LANCZOS)
            room.alpha_composite(img, (round(s['x'] - s['w'] / 2), round(s['y'] - h)))
        room.save(out_dir / f'{theme}-{orient}.png')
        print('preview', out_dir / f'{theme}-{orient}.png')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--theme', choices=['medieval', 'neon'], required=True)
    ap.add_argument('--preview', action='store_true', help='draw the spots into .preview/')
    args = ap.parse_args()
    build(args.theme, args.preview)
