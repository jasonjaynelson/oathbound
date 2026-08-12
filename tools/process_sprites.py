#!/usr/bin/env python3
"""Chroma-key magenta sprites (edge flood) and prepare engine-ready PNGs."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

SRC = Path("/home/jason/.grok/sessions/%2Fhome%2Fjason/019ff7ba-5caa-7ac1-8384-7a67177b95df/images")
DST = Path("/home/jason/oathbound/assets/sprites")
DST.mkdir(parents=True, exist_ok=True)

JOBS = [
    ("1.jpg", "aldric.png", 384),
    ("3.jpg", "slime.png", 256),
    ("4.jpg", "skeleton.png", 280),
    ("5.jpg", "bat.png", 280),
    ("8.jpg", "shade.png", 300),
    ("9.jpg", "duke.png", 420),
    ("10.jpg", "hollow.png", 384),
    ("11.jpg", "hydra.png", 400),
    ("12.jpg", "mara.png", 384),
    ("7.jpg", "dawneater.png", 420),
    ("13.jpg", "wight.png", 280),
    ("14.jpg", "golem.png", 340),
]


def is_bg(r, g, b):
    mx = r if r > g else g
    if b > mx:
        mx = b
    mn = r if r < g else g
    if b < mn:
        mn = b
    sat = (mx - mn) / mx if mx > 1 else 0
    magenta = r > 130 and b > 80 and g < 210 and (r + b) > g * 1.55 and sat > 0.12
    hot = r > 180 and b > 140 and g < 190
    return magenta or hot


def chroma_key(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    pix = rgba.load()
    w, h = rgba.size
    marked = bytearray(w * h)
    q = deque()

    def try_add(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        i = y * w + x
        if marked[i]:
            return
        r, g, b, _a = pix[x, y]
        if is_bg(r, g, b):
            marked[i] = 1
            q.append((x, y))

    for x in range(w):
        try_add(x, 0)
        try_add(x, h - 1)
    for y in range(h):
        try_add(0, y)
        try_add(w - 1, y)
    while q:
        x, y = q.popleft()
        pix[x, y] = (0, 0, 0, 0)
        try_add(x + 1, y)
        try_add(x - 1, y)
        try_add(x, y + 1)
        try_add(x, y - 1)

    # Despill a 1px ring around remaining subject
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and pix[nx, ny][3] == 0:
                    edge = True
                    break
            if not edge:
                continue
            if is_bg(r, g, b) or (r > 140 and b > 100 and g < r * 0.85):
                avg = (g * 2 + 40)
                nr = min(255, int(r * 0.55 + avg * 0.2))
                nb = min(255, int(b * 0.55 + avg * 0.2))
                pix[x, y] = (nr, min(255, g + 20), nb, int(a * 0.25))
    return rgba


def crop_alpha(im: Image.Image, pad: int = 6) -> Image.Image:
    alpha = im.split()[-1]
    bbox = alpha.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def fit_max(im: Image.Image, edge: int) -> Image.Image:
    w, h = im.size
    s = min(edge / w, edge / h, 1.0)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def seam_blend(im: Image.Image, band: int = 48) -> Image.Image:
    """Wrap-blend edges so the tile does not show a hard seam."""
    im = im.convert("RGB")
    w, h = im.size
    out = im.copy()
    px = im.load()
    op = out.load()
    for y in range(h):
        for i in range(band):
            t = i / band
            l = px[i, y]
            r = px[w - 1 - i, y]
            op[i, y] = tuple(int(l[c] * t + r[c] * (1 - t)) for c in range(3))
            op[w - 1 - i, y] = tuple(int(r[c] * t + l[c] * (1 - t)) for c in range(3))
    for x in range(w):
        for i in range(band):
            t = i / band
            top = op[x, i]
            bot = op[x, h - 1 - i]
            op[x, i] = tuple(int(top[c] * t + bot[c] * (1 - t)) for c in range(3))
            op[x, h - 1 - i] = tuple(int(bot[c] * t + top[c] * (1 - t)) for c in range(3))
    return out.filter(ImageFilter.SMOOTH)


def process_ground():
    im = Image.open(SRC / "2.jpg").convert("RGB")
    im = im.resize((256, 256), Image.Resampling.LANCZOS)
    im = seam_blend(im, 36)
    im.save(DST / "ground.png", "PNG")
    check = Image.new("RGB", (512, 512))
    check.paste(im, (0, 0))
    check.paste(im, (256, 0))
    check.paste(im, (0, 256))
    check.paste(im, (256, 256))
    check.save(DST / "_tile_check.png", "PNG")


def process_title():
    im = Image.open(SRC / "6.jpg").convert("RGB")
    im.save(DST / "title.jpg", "JPEG", quality=90)


def main():
    process_ground()
    process_title()
    for src, name, edge in JOBS:
        path = SRC / src
        if not path.exists():
            print("skip missing", src)
            continue
        im = chroma_key(Image.open(path))
        im = crop_alpha(im)
        im = fit_max(im, edge)
        im.save(DST / name, "PNG")
        print("wrote", name, im.size)


if __name__ == "__main__":
    main()
