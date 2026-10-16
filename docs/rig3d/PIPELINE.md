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

- Studio: charcoal cyclorama with a soft floor reflection, softbox key / fill / top, two strip lights
  for edge highlights on the black anodised extrusions, `studio_small_09` HDRI for reflections.
- Camera: rear three-quarter, 30 degrees round from behind, 14 degrees up, about 90 mm on full frame at
  7.4 m, f/4 focused on the wheel; AgX Punchy; 160 samples + OpenImageDenoise at 2x, downscaled.
- Materials: black anodised aluminium (anisotropic, roughness drift, fine scratches), textured powder
  coat, CC0 fabric normal maps on the seat, grained leatherette bolsters with red stitching and piping,
  carbon wheel plate, rubber, machined aluminium. Brand red is `#e10600` (`--es-red`).
- Screens show a rendered race track (sky HDRI, asphalt/grass textures, kerbs, armco, generic unbranded
  GT cars): one wide driver's-eye panorama split across the triple, a chase-cam view on the top screen.
