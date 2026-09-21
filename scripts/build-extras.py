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
        'decorations': 'medieval_6_season_decorations.png',
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
# Where each milestone object stands, per room orientation, in the room
# image's own pixels: x = centre, y = the line it stands on (its bottom),
# w = drawn width. Chosen on previews (--preview) so each object sits on a
# real surface and clear of the HUD: portrait rooms line them up on the shelf
# above the wall -- the one strip a phone never covers.
SPOTS = {
    'medieval': {
        'landscape': {
            'candle': (196, 634, 40), 'herb': (345, 690, 62), 'goblet': (130, 772, 58),
            'banner': (388, 610, 76), 'crown': (250, 858, 84), 'armour': (452, 805, 92),
        },
        'portrait': {
            # the routine's name plaque hangs on this lintel and grows with the
            # name, so small things keep to the left end, the tall armour
            # stands where it still shows over a long name, and the crown
            # waits by the cat at the right
            'candle': (240, 440, 38), 'herb': (284, 440, 46), 'goblet': (330, 440, 44),
            'armour': (392, 440, 62), 'crown': (568, 440, 58), 'banner': (150, 1030, 72),
        },
    },
    'neon': {
        'landscape': {
            'lavalamp': (450, 233, 30), 'holoplant': (540, 233, 55), 'trophy': (1010, 233, 50),
            'uptime': (1120, 233, 110), 'hologram': (1220, 233, 60), 'arcade': (330, 745, 70),
        },
        'portrait': {
            # packed toward the left so the season's piece gets its own gap
            # between the arcade and the cat, well inside a phone's crop
            'lavalamp': (206, 470, 28), 'holoplant': (254, 470, 46), 'trophy': (304, 470, 42),
            'hologram': (362, 470, 52), 'uptime': (446, 470, 90), 'arcade': (530, 470, 50),
        },
    },
}

# Where each season's decoration goes (x centre, y bottom, w), per
# orientation. Only one season shows at a time, so they may share a spot.
# Medieval has none until its decoration sheet exists.
SEASON_SPOTS = {
    # On the shelf with the milestone objects, like something set out for
    # the season: portrait between the arcade and the cat, landscape in the
    # gap along the top of the wall between the objects.
    'neon': {
        'landscape': {
            'winter': (780, 233, 190), 'autumn': (780, 233, 72),
            'spring': (780, 233, 170), 'summer': (780, 233, 36),
        },
        'portrait': {
            'winter': (598, 470, 84), 'autumn': (598, 470, 52),
            'spring': (598, 470, 80), 'summer': (598, 470, 28),
        },
    },
    'medieval': {'landscape': {}, 'portrait': {}},
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
        item['spots'] = {o: dict(zip('xyw', SPOTS[theme][o][obj])) for o in SPOTS[theme]}
        manifest['milestones'].append(item)

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
    [ups] = layout(up[..., 3], [2], names['upgrades'])
    for key, box, day in zip(['bed', 'crown'], ups, [30, 100]):
        img = crop(up, box)
        spr = out.sprite(img, f'cat-{key}')
        # measured on the cat alone: the top half, above any cushion or pod
        spr['rel'] = round((spr['w'] / body_width(shrink(img), 0.55)) * (cat_body / cat_cw), 4)
        spr['day'] = day
        manifest['cat'][key] = spr

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
        for m in manifest['milestones']:
            s = m['spots'][orient]
            img = Image.open(ROOT / 'public' / m['src'].lstrip('/')).convert('RGBA')
            h = round(img.height * s['w'] / img.width)
            img = img.resize((s['w'], h), Image.LANCZOS)
            room.alpha_composite(img, (round(s['x'] - s['w'] / 2), round(s['y'] - h)))
        for season in manifest['seasons'].values():
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
