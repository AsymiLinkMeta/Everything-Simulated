"""Wheel dashboard art (ES-branded, no third-party marks) for the GT-style wheel display: rev lights, gear, speed, delta."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "assets", "rig3d", "cache", "wheel-dash.png")
W, H = 800, 320
im = Image.new("RGB", (W, H), (4, 6, 9))
d = ImageDraw.Draw(im)
def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
# rev lights: 15 LEDs, green -> red -> blue, the first 11 lit
cols = [(40, 220, 90)] * 5 + [(240, 40, 30)] * 5 + [(60, 120, 255)] * 5
for i, c in enumerate(cols):
    x = 40 + i * 49
    lit = i < 11
    d.ellipse((x, 14, x + 30, 44), fill=c if lit else tuple(v // 8 for v in c))
d.rectangle((0, 60, W, 62), fill=(30, 34, 40))
d.text((W // 2, 190), "4", font=font(190), fill=(245, 245, 245), anchor="mm")
d.text((40, 110), "KM/H", font=font(26), fill=(140, 150, 160))
d.text((40, 140), "187", font=font(78), fill=(240, 240, 240))
d.text((W - 40, 110), "DELTA", font=font(26), fill=(140, 150, 160), anchor="ra")
d.text((W - 40, 140), "-0.214", font=font(58), fill=(60, 220, 110), anchor="ra")
d.text((40, 250), "LAP 1:42.381", font=font(30), fill=(200, 205, 210))
d.text((W - 40, 250), "TC 3  ABS 2", font=font(30), fill=(225, 6, 0), anchor="ra")
im.save(out)
print(out)
