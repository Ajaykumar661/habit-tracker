"""Turn a flat #FF00FF key area in supplied artwork into real PNG alpha.

Tooling only — it removes pixels and un-mixes the magenta spill from edge
pixels; it never draws anything. Usage:
    python scripts/key-magenta.py <in.png> <out.png>
"""
import sys
from PIL import Image

MAGENTA = (255, 0, 255)
SOLID = 150   # magenta-ness at/above this -> fully transparent
MARGIN = 4    # px around the key area to clean up edge spill
CLEAN = 25    # magenta-ness at/below this -> untouched

def keyed(src, dst):
    im = Image.open(src).convert('RGBA')
    px = im.load()
    w, h = im.size
    # Only act around the solid key area, so pink flowers / purple cloth
    # elsewhere in the artwork can never be eaten.
    solid = [(x, y) for y in range(h) for x in range(w)
             if min(px[x, y][0], px[x, y][2]) - px[x, y][1] >= SOLID]
    if not solid:
        sys.exit(f'{src}: no #FF00FF key area found')
    x0 = max(0, min(p[0] for p in solid) - MARGIN); x1 = min(w, max(p[0] for p in solid) + MARGIN + 1)
    y0 = max(0, min(p[1] for p in solid) - MARGIN); y1 = min(h, max(p[1] for p in solid) + MARGIN + 1)
    cleared = fringe = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, _ = px[x, y]
            m = min(r, b) - g
            if m <= CLEAN:
                continue
            if m >= SOLID:
                px[x, y] = (0, 0, 0, 0)
                cleared += 1
                continue
            a = (SOLID - m) / (SOLID - CLEAN)
            # un-mix: observed = a*fg + (1-a)*magenta
            fg = [max(0, min(255, round((c - (1 - a) * k) / a))) for c, k in zip((r, g, b), MAGENTA)]
            px[x, y] = (*fg, round(a * 255))
            fringe += 1
    im.save(dst)
    print(f'{dst}: {w}x{h}, key area x{x0}-{x1} y{y0}-{y1}, {cleared} px cleared, {fringe} edge px un-mixed')

if __name__ == '__main__':
    keyed(sys.argv[1], sys.argv[2])
