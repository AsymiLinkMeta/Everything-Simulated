"""
Side-by-side sheet: real studio product photos (left) against the rendered preview (right).

    python3 scripts/rig3d/compare_sheet.py /workspace/rig-ref/trakracer /tmp/rig-final e2e/.shots/compare-vs-reference.png

The references are third-party product photos used only for this local comparison; they are never
shipped or committed.
"""
import os
import sys

from PIL import Image, ImageDraw

REF, RENDERS, OUT = sys.argv[1:4]
PAIRS = [
    ("best/1-front34-cockpit-mounted-screen.png", "frame-s4m0.png"),
    ("best/2-rear34-seat-wheel-pedals.png", "frame-s1m0.png"),
    ("full-rigs/ready-2-race-tr160-racing-simulator-pro-bundle-cop-1.png", "composite.png"),
]
W, H = 760, 620
sheet = Image.new("RGB", (W * 2 + 30, (H + 10) * len(PAIRS) + 10), (40, 40, 44))
for i, (ref, ours) in enumerate(PAIRS):
    for j, path in enumerate((os.path.join(REF, ref), os.path.join(RENDERS, ours))):
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg.convert("RGB")
        im.thumbnail((W, H), Image.LANCZOS)
        x = 10 + j * (W + 10) + (W - im.width) // 2
        y = 10 + i * (H + 10) + (H - im.height) // 2
        sheet.paste(im, (x, y))
d = ImageDraw.Draw(sheet)
d.text((14, sheet.height - 4 - 10), "left: real product photos (reference only)   right: Everything Simulated rendered preview", fill=(200, 200, 200))
sheet.save(OUT)
print("wrote", OUT)
