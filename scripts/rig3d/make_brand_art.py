"""
Everything Simulated branding decals for the rig model, made from the real brand assets:
the ES mark public/Everything_Simulated_LOGO_W+R.png and the display font Teko 700
(public/fonts/teko-latin-700.woff2, the site's --es-font-display), brand red #e10600 (--es-red).

    python3 scripts/rig3d/make_brand_art.py   # needs Pillow, fontTools and brotli (woff2)

Writes assets/rig3d/brand-*.png (transparent); build_rig.py applies them as decals.
"""
import io
import os

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "rig3d")
WHITE = (255, 255, 255, 255)
RED = (225, 6, 0, 255)

ttf = io.BytesIO()
t = TTFont(os.path.join(ROOT, "public", "fonts", "teko-latin-700.woff2"))
t.flavor = None
t.save(ttf)


def font(px):
    ttf.seek(0)
    return ImageFont.truetype(ttf, px)


mark = Image.open(os.path.join(ROOT, "public", "Everything_Simulated_LOGO_W+R.png")).convert("RGBA")
mark = mark.crop(mark.getbbox())


def mark_at(h):
    return mark.resize((round(mark.width * h / mark.height), h), Image.LANCZOS)


def text_img(words, h, colors):
    """A line of words in Teko 700, each word in its own colour, cropped to the ink."""
    f = font(int(h * 1.5))
    gap = int(h * 0.28)
    widths = [f.getbbox(w)[2] - f.getbbox(w)[0] for w in words]
    im = Image.new("RGBA", (sum(widths) + gap * (len(words) - 1) + 20, int(h * 2.2)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = 10
    for w, wd, c in zip(words, widths, colors):
        d.text((x - f.getbbox(w)[0], int(h * 0.2)), w, font=f, fill=c)
        x += wd + gap
    return im.crop(im.getbbox())


def lockup(mark_h, text_colors, words=("EVERYTHING", "SIMULATED"), with_mark=True):
    txt = text_img(list(words), int(mark_h * 0.42), text_colors)
    if not with_mark:
        return txt
    m = mark_at(mark_h)
    gap = int(mark_h * 0.22)
    im = Image.new("RGBA", (m.width + gap + txt.width, mark_h), (0, 0, 0, 0))
    im.alpha_composite(m, (0, 0))
    im.alpha_composite(txt, (m.width + gap, (mark_h - txt.height) // 2))
    return im


def pad(im, p=8):
    out = Image.new("RGBA", (im.width + 2 * p, im.height + 2 * p), (0, 0, 0, 0))
    out.alpha_composite(im, (p, p))
    return out


os.makedirs(OUT, exist_ok=True)
pad(mark_at(512)).save(os.path.join(OUT, "brand-mark.png"), optimize=True)
pad(lockup(220, [WHITE, RED])).save(os.path.join(OUT, "brand-lockup.png"), optimize=True)  # mark + wordmark, dark surfaces
pad(lockup(220, [WHITE, WHITE], with_mark=False)).save(os.path.join(OUT, "brand-wordmark-white.png"), optimize=True)  # on brand-red plates
print("wrote brand-mark.png, brand-lockup.png, brand-wordmark-white.png")
