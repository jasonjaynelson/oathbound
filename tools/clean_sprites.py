#!/usr/bin/env python3
"""Second-pass: punch remaining hot-pink holes and despill rims."""
from pathlib import Path
from PIL import Image

DST = Path("/home/jason/oathbound/assets/sprites")


def clean(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    pix = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            if r > 185 and b > 120 and g < 180 and r > g + 35 and (r + b) > g * 2:
                pix[x, y] = (0, 0, 0, 0)

    # copy for neighbor reads
    src = im.copy()
    sp = src.load()
    pix = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            if a == 0:
                continue
            trans = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or sp[nx, ny][3] == 0:
                    trans += 1
            if trans == 0:
                continue
            magenta = (r + b) * 0.5 - g
            if magenta > 18:
                fade = max(0.15, 1 - trans * 0.18)
                ng = min(255, g + int(magenta * 0.55))
                nr = min(255, int(r * 0.7 + ng * 0.2))
                nb = min(255, int(b * 0.7 + ng * 0.2))
                pix[x, y] = (nr, ng, nb, int(a * fade))
    return im


def main():
    for p in sorted(DST.glob("*.png")):
        if p.name.startswith("_"):
            continue
        if p.name == "ground.png":
            continue
        im = clean(Image.open(p))
        im.save(p, "PNG")
        print("cleaned", p.name)


if __name__ == "__main__":
    main()
