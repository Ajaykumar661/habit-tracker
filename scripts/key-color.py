"""Turn a flat chroma-key area in supplied artwork into real PNG alpha.

Tooling only -- it removes pixels and un-mixes the key colour's spill from
edge pixels; it never draws anything. Usage:

    python scripts/key-color.py <in.png> <out.png> [--key magenta|green]

Medieval art keys on magenta. Neon City keys on green, because a neon scene
is full of hot pink that a magenta key would eat.

Only the largest solid key region is acted on (the wall opening), so a stray
key-coloured pixel elsewhere -- a pink sign, a green bottle -- can never widen
the area that gets cut out.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

KEYS = {
    # key colour, and how "key-ish" a pixel is: how far the key's own
    # channel(s) outrun the others.
    'magenta': ((255, 0, 255), lambda r, g, b: np.minimum(r, b) - g),
    'green':   ((0, 255, 0),   lambda r, g, b: g - np.maximum(r, b)),
}
SOLID = 150   # key-ness at/above this -> fully transparent
MARGIN = 4    # px around the key area to clean up edge spill
CLEAN = 25    # key-ness at/below this -> untouched


def largest_region(mask):
    """Bounding box of the biggest 4-connected True region."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best, best_box = 0, None
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)]); seen[y0, x0] = True
        n = 0; bx0 = bx1 = x0; by0 = by1 = y0
        while q:
            y, x = q.popleft(); n += 1
            bx0 = min(bx0, x); bx1 = max(bx1, x); by0 = min(by0, y); by1 = max(by1, y)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        if n > best:
            best, best_box = n, (bx0, by0, bx1 + 1, by1 + 1)
    return best, best_box


def keyed(src, dst, key='magenta'):
    colour, keyness = KEYS[key]
    im = np.array(Image.open(src).convert('RGBA')).astype(np.float64)
    h, w = im.shape[:2]
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    m = keyness(r, g, b)

    n, box = largest_region(m >= SOLID)
    if not box:
        sys.exit(f'{src}: no {key} key area found')
    x0 = max(0, box[0] - MARGIN); y0 = max(0, box[1] - MARGIN)
    x1 = min(w, box[2] + MARGIN); y1 = min(h, box[3] + MARGIN)

    sub = im[y0:y1, x0:x1]
    ms = m[y0:y1, x0:x1]
    solid = ms >= SOLID
    # Reported only: the key colour the artwork actually used. Magenta
    # un-mixes against the ideal colour (unchanged from the original script);
    # green is despilled and needs no colour at all.
    measured = np.median(sub[..., :3][solid], axis=0)
    fringe = (ms > CLEAN) & ~solid
    a = np.clip((SOLID - ms) / (SOLID - CLEAN), 0, 1)
    safe = np.where(a > 0, a, 1.0)[..., None]
    if key == 'magenta':
        # Algebraic un-mix: observed = a*fg + (1-a)*key. Proven on the
        # medieval art, and kept exactly so re-running it changes nothing.
        un = np.clip((sub[..., :3] - (1 - safe) * np.array(colour)) / safe, 0, 255)
    else:
        # Despill: cap green at the larger of red and blue. The algebraic
        # un-mix overshoots on dark edge pixels -- (20,120,20) comes out as
        # (44,0,44), a visible pink line along the opening.
        un = sub[..., :3].copy()
        un[..., 1] = np.minimum(un[..., 1], np.maximum(un[..., 0], un[..., 2]))
    sub[..., :3] = np.where(fringe[..., None], un, sub[..., :3])
    sub[..., 3] = np.where(solid, 0, np.where(fringe, np.round(a * 255), sub[..., 3]))
    sub[solid] = 0
    im[y0:y1, x0:x1] = sub

    Image.fromarray(im.astype(np.uint8)).save(dst)
    print(f'{dst}: {w}x{h}, {key} key {tuple(int(c) for c in measured)} area x{box[0]}-{box[2] - 1} y{box[1]}-{box[3] - 1}, '
          f'{int(solid.sum())} px cleared, {int(fringe.sum())} edge px un-mixed')
    return box


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    key = sys.argv[sys.argv.index('--key') + 1] if '--key' in sys.argv else 'magenta'
    if '--key' in sys.argv:
        args = [a for a in args if a != key]
    keyed(args[0], args[1], key)
