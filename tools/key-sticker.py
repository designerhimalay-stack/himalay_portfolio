#!/usr/bin/env python3
"""
Take a sticker that was exported ON A WHITE BACKGROUND and give it back its alpha.

The hard part is that a die-cut sticker's border is white and the background it
was exported on is also white, so keying by colour alone eats the border. What
separates them is the drop shadow: reading across one of these files the values
run 254 (background) -> ~218 (shadow) -> 255 (the border, enclosed by that
shadow). So the background is not "white", it is "white you can reach from the
edge of the canvas without crossing the shadow" — which is a flood fill, not a
threshold.

Everything the fill cannot reach is the sticker, its border and its shadow, and
all of that is kept. The faint outer shadow the fill does eat is re-derived as
soft alpha on the way out, so the sticker still lands on a tinted card without a
pale rectangle around it.

    python3 tools/key-sticker.py in.png out.png [--near 250] [--pad 12]
"""
import argparse
from collections import deque
from PIL import Image, ImageFilter


def key(src, out, near=250, pad=12):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()

    def bright(c):
        return c[0] >= near and c[1] >= near and c[2] >= near

    # ---- flood fill the reachable near-white from all four edges ----
    outside = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bright(px[x, y]) and not outside[y * w + x]:
                outside[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if bright(px[x, y]) and not outside[y * w + x]:
                outside[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not outside[ny * w + nx] and bright(px[nx, ny]):
                outside[ny * w + nx] = 1; q.append((nx, ny))

    # ---- alpha ----
    a = Image.new('L', (w, h), 0)
    ap = a.load()
    # Binary, then feathered. Reconstructing the shadow's faint outer tail as soft
    # alpha was tried and is not worth it: the exported paper varies by a value or
    # two, so any scale of (paper - lum) leaves a whisper of alpha across most of
    # the canvas — invisible on screen, but enough to defeat the bbox crop below
    # and ship the entire dead margin. The shadow that actually reads is dark
    # enough to have blocked the flood fill, so it is already on the inside here.
    for y in range(h):
        row = y * w
        for x in range(w):
            ap[x, y] = 0 if outside[row + x] else 255
    # a pixel of feather so the cut edge antialiases instead of stair-stepping
    a = a.filter(ImageFilter.GaussianBlur(0.8))

    im = im.convert('RGBA')
    im.putalpha(a)

    bbox = a.getbbox()
    if bbox:
        l, t, r, b = bbox
        l = max(0, l - pad); t = max(0, t - pad)
        r = min(w, r + pad); b = min(h, b + pad)
        im = im.crop((l, t, r, b))                  # drop the dead canvas margin
    return im, im.size


if __name__ == '__main__':
    ap_ = argparse.ArgumentParser()
    ap_.add_argument('src'); ap_.add_argument('out')
    ap_.add_argument('--near', type=int, default=250)
    ap_.add_argument('--pad', type=int, default=12)
    a = ap_.parse_args()
    img, size = key(a.src, a.out, a.near, a.pad)
    img.save(a.out)
    print('wrote %s %s' % (a.out, size))
