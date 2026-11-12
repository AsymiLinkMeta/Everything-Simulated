# Rig builder preview: render pipeline

The preview on `/build` is a studio product photo of a generic, Everything Simulated branded aluminium
profile rig, rendered in Blender (Cycles) from a scripted model. No Trak Racer (or any third-party)
branding appears in the model, the screen content or the renders.

## Why full-frame photos, not per-part layers

The earlier preview stacked one transparent render per part. That loses everything that makes a render
read as a photo: contact shadows between parts, occlusion, inter-reflections and the floor reflection.
Now every visually distinct build is one opaque render of the whole scene:

| frame key | contents |
| --- | --- |
| `s0m0` / `s0m1` | cockpit only (frame, seat, wheelbase, wheel, pedals), on the floor / on motion |
| `stm0` / `stm1` | + freestanding stand, no monitors |
| `s1m*` | + one curved screen |
| `s2m*` | + dual curved screens |
| `s3m*` | + triple curved screens |
| `s4m*` | + triple and the distinct top screen on its own posts |

Small add-ons (PC, side mount, shifter, handbrake, VR headset) are overlays: transparent renders with
the cockpit as an invisible holdout (so they tuck behind it correctly) and their own floor shadow from a
shadow catcher; raised variants for the ones that ride the motion platform. `pack_frames.py` checks the
overlays composited on `s3m1` against one render of everything.

`rigView()` in `src/lib/es/builder-core.ts` maps a build to its frame and overlays; only that photo is
loaded (AVIF with WebP fallback, 900 px wide from a 1800 px render). An empty build shows the triple
photo dimmed.

## Steps

```sh
python3 scripts/rig3d/fetch_assets.py            # CC0 HDRIs + textures (Poly Haven) -> assets/rig3d/cache
python3 scripts/rig3d/make_brand_art.py          # ES decals from public/Everything_Simulated_LOGO_W+R.png + Teko
blender -b --factory-startup -P scripts/rig3d/render_screen_scene.py   # in-game track images for the screens
blender -b --factory-startup -P scripts/rig3d/build_rig.py             # model -> assets/rig3d/rig.blend
blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_rig.py -- --mode parts --samples 160 --out /workspace/rig-renders
python3 scripts/rig3d/pack_parts.py /workspace/rig-renders  # -> public/builder-rig/parts + src/components/es/rig-parts.ts
```

The builder preview (src/components/es/rig-preview.tsx) shows the complete rig as a see-through ghost
with every part outlined, and lights up the picked parts. `--mode parts` renders, per screen layout
(s1, s2, s3, s4 = triple + curved top screen), one studio beauty with every part in it (motion platform
and add-ons included, no depth of field) plus an anti-aliased mask per part (object index pass), and an
empty-studio plate. pack_parts.py builds the ghost (plate showing through a flattened copy of the rig,
plus part outlines), cuts each part out of the beauty with its mask (so lit parts line up exactly and
occlusion is real), and makes a soft ring per part that the browser uses as a CSS mask for the red
"added" pulse and the hover outline. Only the ghost (~20-30 KB) loads up front.

The older full-frame modes (`frames`, `overlays`, `full`, with pack_frames.py) are kept for reference.

## Look

- Studio: charcoal cyclorama (near-black, roughness 0.96 so the Key does not paint a hot ellipse),
  softbox key / fill / top, two strip lights for T-slot edges, `studio_small_09` HDRI (strength 0.38)
  for wrap and reflections. The Key and strips are light-linked off the cyclorama.
- Camera: rear three-quarter, 30 degrees round from behind, 14 degrees up, about 90 mm on full frame at
  7.4 m, f/4 focused on the wheel; AgX Medium High Contrast; 128–192 samples + OpenImageDenoise.
  Marketing stills: `render_studio.py --real --force`.
- Materials: black anodised aluminium (anisotropic, roughness drift, fine scratches), textured powder
  coat, CC0 fabric normal maps on the seat, grained leatherette bolsters with red stitching and piping,
  carbon wheel plate, rubber, machined aluminium. Brand red is `#e10600` (`--es-red`).
- Screens show a rendered race track (sky HDRI, asphalt/grass textures, kerbs, armco, generic unbranded
  GT cars): one wide driver's-eye panorama split across the triple, a chase-cam view on the top screen.


## Photoreal pass (2026-11-12)

Geometry and materials were tightened against public component specs (40-series T-slot opening 8.2 mm
and depth 11 mm with a proper T chamber; 12 Nm-class DD envelope 281 × 130 × 110 mm; 32" 16:9 1000R
active area 697 × 392 mm, 4 mm air between neighbouring bezels). The H-pattern shifter and hydraulic-
style handbrake are modelled as assemblies (gate, boot, leather knob/grip, pivot, cables) rather than
bevelled boxes. Pedal faces have rubber pads on a matte black tray; motion corners are cylindrical
linear actuators with stainless pistons, rubber bellows and pads. The wheel rim is Alcantara-style
suede with leather sidewalls and a double lock-stitch.

Still-image output lives in `/workspace/es-redesign/photoreal/final/` (not live). Packed as
`es-*-pr1.jpg` (+ WebP) and uploaded additively to Storage. Data script
`scripts/data/photoreal-art-pr1.sql` (rollback alongside) is ready to apply after the look is
approved; it must not be run before that. The home hero is a static `/rigs/es-hero-wide.jpg` and
needs a follow-up pack into `public/rigs` once approved. Builder ghost layers (`pack_parts.py`)
still use the previous beauty pass until they are re-rendered.

## Photoreal phase 2 (2026-11-12)

Seat: 5 mm object-mapped plain-weave cloth (gitignored `assets/rig3d/cache/fabric_weave_*.png`,
2048-px tile, 48 yarns, 5 mm centres, 0.240 m object-mapped; bump from the height map). H-gate: boolean-cut satin plate, camera raised so the H
reads. Deck side plates carry the ES mark only (the wordmark cropped to "EVE"). PC: mid-tower
mesh-front case with tinted glass and a visible generic build, ES branding only. Starter and
haptic prebuilds, wide `cat-*` heroes, `hero-tall`, and builder ghosts (ES red `#e10600`
outline in `pack_parts.py`) are in this pass.

Data: `scripts/data/photoreal-art-pr2.sql` (rollback alongside) is prepared and **not applied**.
Stage images (`STAGE_IMAGES` cat-* and mobile hero-tall, including `/prebuilds`) are a code
change on `feat/photoreal-pipeline` and go live only on merge (Patrick's "release").
