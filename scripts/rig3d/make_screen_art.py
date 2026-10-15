"""
Draws the generic (unbranded) images shown on the preview's screens: a dusk race-track
panorama for the main screens (left third, centre third, right third of one wide frame, so a
triple reads as one continuous view) and a telemetry page for the top screen.

    python3 scripts/rig3d/make_screen_art.py

Writes assets/rig3d/screen-pano.png and assets/rig3d/screen-top.png (build_rig.py packs them
into rig.blend). Needs Pillow. Deterministic: no randomness, no fonts.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "rig3d")
W, H = 3072, 600  # three 1.71:1 panels side by side
HZ = int(H * 0.44)  # horizon
VX = W // 2  # vanishing point


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def pano():
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    # dusk sky: deep blue at the top to warm orange at the horizon
    for y in range(HZ):
        t = y / HZ
        c = lerp((24, 44, 96), (120, 110, 150), min(1, t * 1.4)) if t < 0.7 else lerp((120, 110, 150), (255, 150, 70), (t - 0.7) / 0.3)
        d.line([(0, y), (W, y)], fill=c)
    # sun glow just above the horizon, right of centre
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([VX + 380, HZ - 120, VX + 620, HZ + 60], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    im = Image.composite(Image.new("RGB", (W, H), (255, 214, 140)), im, glow)
    d = ImageDraw.Draw(im)
    # distant hills
    pts = [(0, HZ)]
    for x in range(0, W + 1, 16):
        y = HZ - 28 - 22 * math.sin(x / 210.0) - 14 * math.sin(x / 67.0 + 1.3) - 30 * math.exp(-((x - 700) / 260) ** 2) - 24 * math.exp(-((x - 2450) / 300) ** 2)
        pts.append((x, int(y)))
    pts.append((W, HZ))
    d.polygon(pts, fill=(46, 52, 74))
    # grass
    for y in range(HZ, H):
        t = (y - HZ) / (H - HZ)
        d.line([(0, y), (W, y)], fill=lerp((60, 92, 52), (34, 70, 30), t))
    # track: a gentle right-hander converging to the vanishing point
    def edge(t, side):
        # t 0 at the horizon, 1 at the bottom of the frame
        half = 6 + t ** 1.15 * 1500
        bend = (1 - t) ** 2 * 260
        return VX + bend + side * half
    rows = 220
    for i in range(rows):
        t0, t1 = i / rows, (i + 1) / rows
        y0, y1 = HZ + t0 * (H - HZ), HZ + t1 * (H - HZ)
        l0, r0, l1, r1 = edge(t0, -1), edge(t0, 1), edge(t1, -1), edge(t1, 1)
        asphalt = lerp((92, 92, 100), (52, 52, 58), t0)
        d.polygon([(l0, y0), (r0, y0), (r1, y1), (l1, y1)], fill=asphalt)
        # kerbs: red / white bands, wider toward the viewer
        k = 0.06
        stripe = int((1 / (t0 + 0.04)) * 3) % 2
        col = (225, 30, 20) if stripe else (240, 240, 240)
        for side in (-1, 1):
            a0, a1 = edge(t0, side), edge(t1, side)
            b0, b1 = a0 + side * (a0 - VX) * k * 0.3 + side * 2, a1 + side * (a1 - VX) * k * 0.3 + side * 2
            d.polygon([(a0, y0), (b0, y0), (b1, y1), (a1, y1)], fill=col)
        # centre dashes
        if int((1 / (t0 + 0.05)) * 2.2) % 2:
            c0, c1 = (l0 + r0) / 2, (l1 + r1) / 2
            w0, w1 = 1 + t0 * 14, 1 + t1 * 14
            d.polygon([(c0 - w0, y0), (c0 + w0, y0), (c1 + w1, y1), (c1 - w1, y1)], fill=(220, 220, 210))
    # trackside: barriers and a few poles left and right
    for side in (-1, 1):
        for j in range(14):
            t = 0.05 + j * 0.065
            x = edge(t, side) + side * (40 + t * 260)
            y = HZ + t * (H - HZ)
            h = 6 + t * 90
            d.rectangle([x - 1 - t * 4, y - h, x + 1 + t * 4, y], fill=(200, 200, 205))
        bpts = [(edge(t, side) + side * (30 + t * 200), HZ + t * (H - HZ) - (3 + t * 30)) for t in [k / 20 for k in range(21)]]
        bpts2 = [(x, y + 3 + i * 1.6) for i, (x, y) in enumerate(bpts)]
        d.polygon(bpts + bpts2[::-1], fill=(30, 110, 200))
    # car ahead: rear view, red, with lit tail lights
    cx, cy, cw = VX + 70, HZ + 120, 210
    d.rounded_rectangle([cx - cw / 2, cy - 50, cx + cw / 2, cy + 22], 14, fill=(170, 18, 14))
    d.polygon([(cx - cw * 0.32, cy - 50), (cx + cw * 0.32, cy - 50), (cx + cw * 0.22, cy - 86), (cx - cw * 0.22, cy - 86)], fill=(120, 12, 10))
    d.polygon([(cx - cw * 0.26, cy - 54), (cx + cw * 0.26, cy - 54), (cx + cw * 0.18, cy - 82), (cx - cw * 0.18, cy - 82)], fill=(40, 46, 60))
    d.rectangle([cx - cw * 0.62, cy - 74, cx + cw * 0.62, cy - 64], fill=(20, 20, 22))  # wing
    for s in (-1, 1):
        d.rectangle([cx + s * cw * 0.5 - 6, cy - 72, cx + s * cw * 0.5 + 6, cy - 50], fill=(20, 20, 22))
        d.rounded_rectangle([cx + s * cw * 0.5 - (34 if s > 0 else 0) - (0 if s > 0 else -0), cy - 34, cx + s * cw * 0.5 + (0 if s > 0 else 34), cy - 20], 4, fill=(255, 60, 40))
        d.rounded_rectangle([cx + s * (cw / 2 - 10) - 26, cy + 4, cx + s * (cw / 2 - 10) + 26, cy + 40], 8, fill=(14, 14, 16))
    d.ellipse([cx - cw * 0.65, cy + 30, cx + cw * 0.65, cy + 48], fill=(30, 30, 34))
    # HUD on the centre third: rev bar, gear, speed, minimap (shapes only, no text)
    c0 = W // 3
    for i in range(16):
        col = (60, 220, 90) if i < 9 else (255, 200, 30) if i < 13 else (255, 40, 40)
        d.rounded_rectangle([c0 + 360 + i * 24, 26, c0 + 380 + i * 24, 42], 3, fill=col if i < 12 else (70, 70, 74))
    d.rounded_rectangle([c0 + 440, 470, c0 + 584, 570], 12, fill=(12, 12, 16))
    for seg in [(0, 0, 1, 0), (1, 0, 1, 1), (1, 1, 0, 1), (0, 1, 0, 2), (0, 2, 1, 2)]:  # a "2" in segments
        x0, y0, x1, y1 = seg
        d.line([(c0 + 490 + x0 * 44, 486 + y0 * 34), (c0 + 490 + x1 * 44, 486 + y1 * 34)], fill=(255, 255, 255), width=9)
    d.rounded_rectangle([c0 + 70, 470, c0 + 300, 570], 12, fill=(12, 12, 16))
    d.arc([c0 + 100, 482, c0 + 270, 650], 200, 340, fill=(60, 60, 66), width=12)
    d.arc([c0 + 100, 482, c0 + 270, 650], 200, 300, fill=(255, 60, 40), width=12)
    d.rounded_rectangle([c0 + 760, 450, c0 + 960, 570], 12, fill=(12, 12, 16))
    track = [(c0 + 790 + 140 * (0.5 + 0.45 * math.cos(a) * (1 + 0.25 * math.sin(2 * a))), 465 + 90 * (0.5 + 0.42 * math.sin(a))) for a in [k * math.pi / 30 for k in range(61)]]
    d.line(track, fill=(230, 230, 230), width=5)
    d.ellipse([track[8][0] - 9, track[8][1] - 9, track[8][0] + 9, track[8][1] + 9], fill=(255, 60, 40))
    return im


def top():
    w, h = 1024, 588
    im = Image.new("RGB", (w, h), (26, 38, 66))
    d = ImageDraw.Draw(im)
    for x in range(0, w, 64):
        d.line([(x, 0), (x, h)], fill=(40, 54, 86))
    for y in range(0, h, 64):
        d.line([(0, y), (w, y)], fill=(40, 54, 86))
    traces = [((60, 210, 255), 150, 70, 0.021), ((255, 70, 50), 300, 45, 0.034), ((90, 230, 110), 440, 55, 0.017)]
    for col, base, amp, f in traces:
        pts = [(x, base - amp * (math.sin(x * f) * 0.7 + math.sin(x * f * 2.7 + 1) * 0.3)) for x in range(0, w, 4)]
        d.line(pts, fill=col, width=5)
    for i, col in enumerate([(60, 210, 255), (255, 70, 50), (90, 230, 110), (255, 200, 30)]):
        d.rounded_rectangle([24 + i * 250, h - 70, 24 + i * 250 + 200, h - 26], 8, fill=(18, 24, 38), outline=col, width=3)
        d.rectangle([40 + i * 250, h - 56, 40 + i * 250 + 60 + 30 * i, h - 40], fill=col)
    return im


os.makedirs(OUT, exist_ok=True)
pano().save(os.path.join(OUT, "screen-pano.png"), optimize=True)
top().save(os.path.join(OUT, "screen-top.png"), optimize=True)
print("wrote screen-pano.png, screen-top.png")
