#!/usr/bin/env python3
"""Draw the Tally Wall app icon.

The icon is composed on a 32x32 pixel grid and scaled up with nearest-
neighbour, so every edge lands on a whole pixel at any output size. Drawing
it rather than downscaling artwork is what keeps it reading as 16-bit at
48px on a home screen, where a resampled illustration turns to mush.

The mark is a five-bar gate: four uprights and the diagonal that closes
them -- the same tally the wall itself is made of.

    python scripts/build-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

PANEL = (20, 23, 15, 255)        # --panel
PANEL_ALT = (27, 31, 21, 255)    # --panel-alt
AMBER = (224, 164, 88, 255)      # --amber
AMBER_DIM = (122, 90, 48, 255)   # --amber-dim
CREAM = (234, 230, 210, 255)     # --cream
BORDER = (5, 5, 3, 255)          # --border-dark

GRID = 32


def draw_mark(bg, *, margin, framed):
    """The tally mark on a 32x32 grid."""
    im = Image.new('RGBA', (GRID, GRID), bg)
    d = ImageDraw.Draw(im)

    if framed:
        # a stone panel with the amber keyline the UI uses everywhere
        d.rectangle([margin, margin, GRID - 1 - margin, GRID - 1 - margin], fill=PANEL_ALT)
        d.rectangle([margin, margin, GRID - 1 - margin, GRID - 1 - margin], outline=BORDER)
        d.rectangle([margin + 1, margin + 1, GRID - 2 - margin, GRID - 2 - margin], outline=AMBER_DIM)

    top, bottom = 10, 22
    # four uprights, two pixels wide so they survive any downscale
    for i, x in enumerate((9, 13, 17, 21)):
        d.rectangle([x, top, x + 1, bottom], fill=CREAM)

    # the fifth stroke, drawn as a staircase so it stays a pixel diagonal
    x0, x1 = 7, 24
    for step, x in enumerate(range(x0, x1)):
        y = bottom - 1 - int((step / (x1 - x0 - 1)) * (bottom - top - 1))
        d.rectangle([x, y, x, y + 1], fill=AMBER)

    return im


def write(im, path, size):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.resize((size, size), Image.NEAREST).save(path)
    print(f'  {path.relative_to(ROOT)}  {size}x{size}')


def main():
    # Plain icon: the mark fills the tile, with the frame.
    icon = draw_mark(PANEL, margin=2, framed=True)
    # Maskable icon: Android crops to a circle, so everything important has
    # to sit inside the middle 80%. No frame -- it would be cropped away.
    maskable = draw_mark(PANEL, margin=6, framed=False)

    print('web:')
    web = ROOT / 'public' / 'icons'
    for size in (192, 512):
        write(icon, web / f'icon-{size}.png', size)
        write(maskable, web / f'maskable-{size}.png', size)
    write(icon, web / 'apple-touch-icon.png', 180)
    write(icon, ROOT / 'public' / 'favicon.png', 64)

    print('android:')
    # Capacitor's generated densities, so the launcher stops being the
    # default placeholder.
    for folder, size in (
        ('mipmap-mdpi', 48), ('mipmap-hdpi', 72), ('mipmap-xhdpi', 96),
        ('mipmap-xxhdpi', 144), ('mipmap-xxxhdpi', 192),
    ):
        base = ROOT / 'android/app/src/main/res' / folder
        if not base.exists():
            continue
        write(icon, base / 'ic_launcher.png', size)
        write(icon, base / 'ic_launcher_round.png', size)
        write(maskable, base / 'ic_launcher_foreground.png', size)

    print('ios:')
    ios = ROOT / 'ios/App/App/Assets.xcassets/AppIcon.appiconset'
    if ios.exists():
        write(icon, ios / 'AppIcon-512@2x.png', 1024)


if __name__ == '__main__':
    main()
