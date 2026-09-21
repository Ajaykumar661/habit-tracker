"""Find the sprites on a generated sprite sheet without hand-measuring it.

The medieval sheets were measured by hand into build-scene-fx.py. Doing that
again for every theme does not scale, and generated sheets are never on an
exact grid anyway. This finds each sprite as a connected blob, groups blobs
into rows, and checks the count per row against what the sheet was asked to
contain -- so a sheet that came back wrong fails loudly instead of slicing
into nonsense.

Blobs are found on a slightly dilated mask, so a spark made of a dozen loose
dots, or a glow with a faint halo, comes out as one sprite rather than many.
"""
from collections import deque

import numpy as np


def dilate(mask, r):
    """Binary dilation by a (2r+1)^2 box, via an integral image."""
    if r <= 0:
        return mask
    p = np.pad(mask.astype(np.int32), r)
    c = np.pad(p.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    n = 2 * r + 1
    s = c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]
    return s[:mask.shape[0], :mask.shape[1]] > 0


def blobs(alpha, thresh=8, join=6, step=2):
    """Bounding boxes (x0, y0, x1, y1) of sprites, in full-resolution pixels.

    Labelled on a `step`-downsampled mask for speed; boxes are then tightened
    against the real alpha so nothing is clipped.
    """
    solid = alpha > thresh
    small = solid[::step, ::step]
    grown = dilate(small, max(1, join // step))
    h, w = grown.shape
    seen = np.zeros_like(grown)
    boxes = []
    for y0, x0 in zip(*np.nonzero(grown)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)]); seen[y0, x0] = True
        bx0 = bx1 = x0; by0 = by1 = y0
        while q:
            y, x = q.popleft()
            bx0 = min(bx0, x); bx1 = max(bx1, x); by0 = min(by0, y); by1 = max(by1, y)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and grown[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        # back to full resolution, then tighten to the real pixels inside
        X0, Y0 = bx0 * step, by0 * step
        X1, Y1 = min(alpha.shape[1], (bx1 + 1) * step), min(alpha.shape[0], (by1 + 1) * step)
        ys, xs = np.nonzero(solid[Y0:Y1, X0:X1])
        if len(ys) < 12:          # dust, not a sprite
            continue
        boxes.append((X0 + xs.min(), Y0 + ys.min(), X0 + xs.max() + 1, Y0 + ys.max() + 1))
    return boxes


def _merge(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _area(b):
    return (b[2] - b[0]) * (b[3] - b[1])


def _centre(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def layout(alpha, expected, name, **kw):
    """Rows of sprite boxes matching `expected` (sprites per row, top down).

    Rows are split at the largest vertical gaps between blob centres -- we
    know how many rows the sheet was asked for, so there is no threshold to
    tune. Within a row, stray fragments (a spark dot that drifted, the loose
    glints around a holographic butterfly) are folded into their nearest
    sprite, smallest first, until the count matches. A row that comes up
    *short* is a sheet that came back wrong, and stops the build.
    """
    boxes = blobs(alpha, **kw)
    k = len(expected)
    if len(boxes) < sum(expected):
        raise SystemExit(f'{name}: found {len(boxes)} sprites, expected at least {sum(expected)}')
    order = sorted(boxes, key=lambda b: _centre(b)[1])
    cys = [_centre(b)[1] for b in order]
    gaps = sorted(range(len(cys) - 1), key=lambda i: cys[i + 1] - cys[i], reverse=True)[:k - 1]
    cuts = sorted(gaps)
    groups, start = [], 0
    for c in cuts:
        groups.append(order[start:c + 1]); start = c + 1
    groups.append(order[start:])

    out = []
    for i, (items, want) in enumerate(zip(groups, expected)):
        items = sorted(items, key=lambda b: b[0])
        while len(items) > want:
            small = min(range(len(items)), key=lambda j: _area(items[j]))
            sx, sy = _centre(items[small])
            near = min((j for j in range(len(items)) if j != small),
                       key=lambda j: (_centre(items[j])[0] - sx) ** 2 + (_centre(items[j])[1] - sy) ** 2)
            merged = _merge(items[near], items[small])
            items = [b for j, b in enumerate(items) if j not in (small, near)] + [merged]
            items.sort(key=lambda b: b[0])
        if len(items) < want:
            detail = ', '.join(f'x{b[0]}-{b[2]}' for b in items)
            raise SystemExit(f'{name}: row {i + 1} has {len(items)} sprites, expected {want} ({detail})')
        out.append(items)
    return out
