"""
Packs the part passes (render_rig.py --mode parts) into the ghost-and-light-up rig preview.

    python3 scripts/rig3d/pack_parts.py /workspace/rig-renders

Per screen layout (s1, s2, s3, s4):
  ghost-<v>.webp          the whole rig as a dim, desaturated ghost on the studio background, with a
                          thin light outline around every part (drawn from the part masks at 2x).
  lit-<v>-<part>.webp     the part cut out of the photoreal beauty render (alpha = its mask), cropped
                          to its box; laid over the ghost it lines up pixel for pixel.
  edge-<v>-<part>.webp    a soft ring around the part's silhouette, used as a CSS mask for the red
                          "just added" glow and the hover highlight.
Writes public/builder-rig/parts/* and src/components/es/rig-parts.ts.
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

SRC = os.path.join(sys.argv[1], "parts")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "builder-rig", "parts")
MANIFEST = os.path.join(ROOT, "src", "components", "es", "rig-parts.ts")
WIDTH = 900
VARIANTS = ["s1", "s2", "s3", "s4"]
PARTS = ["chassis", "seat", "wheelbase", "wheel", "pedals", "mount", "screens", "motion", "pc", "headset", "sidemount", "shifter", "handbrake"]

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".webp"):
        os.remove(os.path.join(OUT, f))


def write(img, name, **kw):
    tmp = os.path.join(OUT, f"{name}.webp")
    img.save(tmp, format="WEBP", method=6, **kw)
    digest = hashlib.sha1(open(tmp, "rb").read()).hexdigest()[:8]
    final = os.path.join(OUT, f"{name}.{digest}.webp")
    os.replace(tmp, final)
    return os.path.basename(final), os.path.getsize(final)


def arr(img):
    return np.asarray(img).astype(np.float32) / 255.0


def to_img(a, mode):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), mode)


def morph(mask_img, px, op):
    f = ImageFilter.MaxFilter if op == "max" else ImageFilter.MinFilter
    return mask_img.filter(f(2 * px + 1)) if px else mask_img


manifest, sizes = {}, {}
for v in VARIANTS:
    beauty_big = Image.open(os.path.join(SRC, f"beauty-{v}.png")).convert("RGB")
    W, H = beauty_big.size
    s = WIDTH / W
    size = (WIDTH, round(H * s))
    k = max(1, round(W / WIDTH))  # outline widths are given at 900 px, drawn at full size
    masks_big = {}
    for p in PARTS:
        m = Image.open(os.path.join(SRC, f"mask-{v}-{p}-0001.png")).convert("L")
        masks_big[p] = m
    # ---- ghost: desaturate and dim the rig, keep the studio, draw every part's silhouette line
    b = arr(beauty_big)
    cover = np.clip(sum(arr(m) for m in masks_big.values()), 0, 1)[..., None]
    lum = (b @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
    plate_path = os.path.join(SRC, "plate.png")
    plate = arr(Image.open(plate_path).convert("RGB").resize((W, H), Image.LANCZOS)) if os.path.exists(plate_path) else b * 0 + 0.12
    # see-through: the empty studio shows through a faint, desaturated, flattened copy of the rig
    ghost_rgb = plate * 0.62 + (np.sqrt(lum) * 0.22 + 0.05) * 0.38
    g = b * (1 - cover) + ghost_rgb * cover
    line = np.zeros((H, W), np.float32)
    for m in masks_big.values():
        outer = arr(morph(m, k, "max"))
        inner = arr(morph(m, max(1, k // 2), "min"))
        line = np.maximum(line, np.clip(outer - inner, 0, 1))
    line = arr(to_img(line, "L").filter(ImageFilter.GaussianBlur(0.6 * k)))[..., None]
    g = g * (1 - line * 0.6) + np.array([0.82, 0.83, 0.86], np.float32) * line * 0.6
    ghost = to_img(g, "RGB").resize(size, Image.LANCZOS)
    entry = {"ghost": None, "parts": {}}
    entry["ghost"], sizes[f"ghost-{v}"] = write(ghost, f"ghost-{v}", quality=86)
    beauty = beauty_big.resize(size, Image.LANCZOS)
    for p in PARTS:
        m_big = masks_big[p]
        m = m_big.resize(size, Image.LANCZOS)
        bbox = m.point(lambda x: 255 if x > 6 else 0).getbbox()
        if not bbox:
            continue
        pad = 14
        x0, y0 = max(0, bbox[0] - pad), max(0, bbox[1] - pad)
        x1, y1 = min(size[0], bbox[2] + pad), min(size[1], bbox[3] + pad)
        lit = beauty.convert("RGBA")
        lit.putalpha(m)
        lit = lit.crop((x0, y0, x1, y1))
        lit_name, sizes[f"lit-{v}-{p}"] = write(lit, f"lit-{v}-{p}", quality=88, alpha_quality=92)
        # glow ring: a band hugging the silhouette, mostly outside it
        outer = arr(morph(m_big, 3 * k, "max"))
        inner = arr(morph(m_big, k, "min"))
        ring = to_img(np.clip(outer - inner, 0, 1), "L").filter(ImageFilter.GaussianBlur(0.8 * k)).resize(size, Image.LANCZOS)
        edge = Image.new("RGBA", size, (255, 255, 255, 0))
        edge.putalpha(ring)
        edge = edge.crop((x0, y0, x1, y1))
        edge_name, sizes[f"edge-{v}-{p}"] = write(edge, f"edge-{v}-{p}", quality=80, alpha_quality=80)
        entry["parts"][p] = {"lit": lit_name, "edge": edge_name, "box": [x0, y0, x1 - x0, y1 - y0]}
    manifest[v] = entry
    print(v, "ghost", sizes[f"ghost-{v}"] // 1024, "KB;", "parts", sum(sizes[k2] for k2 in sizes if k2.endswith(tuple(f"-{v}-{p}" for p in PARTS))) // 1024, "KB", flush=True)

ts = f"""// Generated by scripts/rig3d/pack_parts.py from the studio part passes (render_rig.py --mode parts). Do not edit.
export type RigPartFile = {{ lit: string; edge: string; box: [number, number, number, number] }};
export type RigPartVariant = {{ ghost: string; parts: Partial<Record<string, RigPartFile>> }};
export const RIG_PARTS_BASE = "/builder-rig/parts/";
export const RIG_PARTS_SIZE = {{ width: {size[0]}, height: {size[1]} }} as const;
export const RIG_PART_VARIANTS: Record<string, RigPartVariant> = {json.dumps(manifest, indent=2)};
"""
open(MANIFEST, "w").write(ts)
print("wrote", MANIFEST, "total", sum(sizes.values()) // 1024, "KB")
