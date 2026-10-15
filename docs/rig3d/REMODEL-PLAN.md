# Rig preview remodel plan (generic profile rig, real proportions)

References: Trak Racer TR160 V5 / TR120S / TR80S cockpits, TR-One wheel and pedal mounts, freestanding triple and
quad (triple + top) stands, and the D-BOX corner-actuator motion bundle. The images and notes are on the box in
/workspace/rig-ref/trakracer/ (not committed, because they are a third party's product photos). The model stays
generic: no logos, no brand panels, and no TR-shaped plates.

## What is wrong with the current model (assets/rig3d/rig.blend, built by scripts/rig3d/build_rig.py)
1. **Finish.** The extrusions are silver/titanium. Real rigs are black anodised with red dust strips in the slots
   and red anodised wheel-mount plates. This is the main reason the render does not read as a real rig.
2. **Frame.** The rails are 580 mm wide, and the uprights are 120x40 profiles sitting on the rails. Real: about
   660 wide x 1440 long, with 160x40 rails on edge, 160x40 front and rear crosses on edge (a low black "box"
   about 180 tall), and 160x40 uprights side-mounted outside the rails with corner brackets.
3. **Wheel.** The wheel is too low (centre about 640 mm). Real: a 120x40 deck channel across the uprights at
   about 800 mm, red side plates, a direct-drive motor on top or on a front plate, and the wheel centre at
   about 900-950 mm.
4. **Pedals.** The pedals sit on a 36 deg deck behind the near upright. Real: a 560 x 420 slotted plate at the
   front, 15-20 deg, low inside the chassis, with a heel rest.
5. **Seat.** The seat is the right idea but sits slightly upright and floats. Real: a GT bucket about 560 wide
   with its top about 1070 high, the back reclined about 25 deg, the cushion about 320 high, and black steel
   side brackets on a slider.
6. **Motion.** The motion is round silver pucks with a 150 mm lift. Real: four black box actuators bolted to the
   outside of the rails at each corner, with silver round feet and a small stroke.
7. **Screens.** The screens hang on a freestanding silver stand. The top screen is the right idea but needs its
   own posts and crossbar, and it must tilt down toward the driver.

## New geometry (mm; +X forward, +Y driver's left, +Z up; same layer names, so the app code is unchanged)
| Part (layer) | Spec |
|---|---|
| chassis / chassis-back | Rails 160x40 on edge at y = +/-310 (outer width 660), x 0-1440, z 15-175. Front and rear crosses 160x40 on edge. Seat cross and pedal cross 80x40. 12 mm rubber feet. Red dust strips: 2 per rail face (upper and lower slot) and on the front cross. |
| (uprights, in chassis) | 160x40, side-mounted outside the rails at x 860-1020, z 15-820, with 2 triangular corner brackets each. |
| wheelbase | 120x40 deck channel across y +/-290 at z 760-800, x about 940. Two red anodised trapezoid side plates (6 mm, hole grid). Generic black DD motor about 140 x 140 x 230, axis tilted 12 deg up toward the driver, on a black front plate. |
| wheel | 300 mm round rim, 3 spokes, centre about z 930, about 380 in front of the cushion front edge. Black and silver hub, a little red. |
| pedals | Slotted black plate 560 x 420 at the front (x 1000-1420) at 18 deg, front edge about z 260, rear edge (heel rest) about z 130. 3 pedals at y +125 / 0 / -125, arms about 230, silver faces, red elastomer on the brake. |
| seat | GT bucket: shell 560 W, top z 1070, back 25 deg from vertical, cushion front z 330, harness and hip slots. Black fabric centre, leather-look bolsters, thin red piping. Black steel side brackets on twin slider rails (x 180-620) on the seat cross. |
| sidemount / shifter / handbrake | 240 mm 80x40 arm out from the right rail at x about 640. 40x40 post to z 520. Folded black steel box bracket. Shifter knob about z 700; handbrake grip about z 820. |
| motion | 4 corner actuators outboard of the rails at x 80 / 1360, y +/-(310+95): black box bodies 170 W x 130 D x 300 H on black brackets bolted to the rail faces, round piston, polished silver 120 dia foot. Raised render lift reduced to 70 mm. |
| mount (freestanding) | Two black 80x40 posts at x 1500, y +/-560, with floor feet running back to x 1180 and forward to x 1750. Crossbar 80x40 at z 1040. |
| mount-sides | Hinged 80x40 side arms from the crossbar ends, angled 55 deg back toward the driver. |
| screen-center / -sides / -dual | 32" class curved panels (1000R), 720 x 420 with thin black bezels, bottom about z 840, VESA box on the back. They are lit with the generated racing scene; the triple shares one panorama, and a dual splits the middle two-thirds. Counts stay exactly 1 / 2 / 3, as today in rigPartStates. |
| mount-top | Two short 40x40 posts from the crossbar up to z 1720 (inboard, y +/-260) and a top crossbar at z 1680. |
| screen-top | A distinct curved panel about 600 x 350, centred over the centre screen. Bottom edge about 20 above the centre screen's top bezel. Tilted 15 deg down toward the driver. Telemetry art. Only drawn with 4+ screens, as today. |
| pc, headset | Keep (generic). Restyle the PC as black with a smoked glass side and red fans. |

## Camera and render
- Rear three-quarter from the driver's right, matching the quad-stand hero shot: azimuth about 30-35 deg,
  elevation about 22-26 deg. The view looks past the seat's right bolster, under the wheel deck, onto the pedals,
  with the screen faces visible.
- Auto-fit the frame to the union of all layers (already in render_rig.py as `fit_camera`). Widen the desktop
  panel from 380 to 440 px at 1280 px and up.
- Brighter studio key with a soft top light, so black anodised profiles show their edges. Add a faint edge
  highlight with an rim light from behind the stand.
- Then: rerun the depth mode and recompute stack_order.py, render all layers at 1200 wide with about 96 samples,
  pack (empty-state weight under 400 KB), run typecheck, lint, unit and builder e2e, take screenshots of every
  build at 390 and 1440, and push after each batch.

## Risks and choices for Patrick
- Freestanding stand vs. cockpit-mounted screen bar (bolted to the uprights). The plan uses freestanding,
  because it shows the top screen clearly.
- An all-black rig on a dark page needs good rim lighting, or it disappears. A light-grey studio backdrop for the
  preview panel is an option.
