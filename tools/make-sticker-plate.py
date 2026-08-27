#!/usr/bin/env python3
"""
Turn a logo PNG into a sticker PLATE — the flat artwork a die-cut sticker is
printed on: the logo, sitting on a white shape that follows the logo's own
outline, on transparency.

This is the half Blender should not be doing. The die line comes from the
artwork's alpha, and dilating an alpha channel is a two-line image operation;
asking a renderer to trace it into geometry would be slower, less exact, and
would fall apart on a mark with interior holes (Stanford's S, the World Bank's
globe). Blender takes it from here and does the half it is actually good at:
paper thickness, a curl, and a real contact shadow.

    python3 tools/make-sticker-plate.py logo.png plate.png [--border 26] [--pad 60]

--border is in pixels of the SOURCE image, so run it on art that is already at
the resolution you want the die line judged at.
"""
import sys, argparse
from PIL import Image, ImageFilter


def plate(src_path, out_path, border=26, pad=60, bg=(255, 255, 255, 255)):
    logo = Image.open(src_path).convert('RGBA')

    # pad first: the dilation has to have somewhere to grow into, and a logo that
    # already touches its own edge would otherwise come out with the die line
    # sheared flat on that side
    w, h = logo.size
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    canvas.paste(logo, (pad, pad))

    alpha = canvas.getchannel('A')

    # Grow the alpha outward. MaxFilter is a dilation by a square kernel, so a
    # single big kernel would square off the corners; several small passes
    # approximate a round one, which is what a real die line looks like.
    grown = alpha
    step = 5                                   # kernel must be odd
    passes = max(1, round(border / (step // 2)))
    for _ in range(passes):
        grown = grown.filter(ImageFilter.MaxFilter(step))

    # A square kernel dilates into square corners, and a die line with mitred
    # corners does not read as cut vinyl. Blurring the grown mask and thresholding
    # it high rounds every convex corner by roughly the blur radius, and closes the
    # nicks between letters at the same time — the standard way to get a ROUND
    # offset out of a square-kernel dilation. Threshold well above half so the
    # blur pulls the edge back in rather than growing it a second time.
    grown = grown.filter(ImageFilter.GaussianBlur(border * 0.42))
    grown = grown.point(lambda v: 255 if v > 150 else 0)
    # one hair of softness so the cut edge antialiases against the card
    grown = grown.filter(ImageFilter.GaussianBlur(0.7))

    sticker = Image.new('RGBA', canvas.size, bg)
    sticker.putalpha(grown)
    sticker.alpha_composite(canvas)            # the logo goes on top of its own backing
    sticker.save(out_path)
    return sticker.size


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--border', type=int, default=26)
    ap.add_argument('--pad', type=int, default=60)
    a = ap.parse_args()
    size = plate(a.src, a.out, a.border, a.pad)
    print('wrote %s %s' % (a.out, size))
