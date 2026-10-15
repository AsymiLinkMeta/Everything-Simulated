# Render notes (working log)

- 2026-10-16: all 12 full-frame studio photos rendered at 1800 px / 160 samples (s0, st, s1-s4 x floor / motion).
  Hero check (quad + motion, `s4m1`) side by side with the reference photos: `/workspace/rig-renders/hero-check.png`
  (box-local; references are third-party photos and are not committed).
- Next: overlays (PC, side mount, shifter, handbrake, VR headset; raised variants), pack, screenshots.
- Overlays rendered (border-limited, about 40 s each instead of 10 min). Overlays on `s3m1` vs one render of
  everything: mean diff 1.43/255, 0.7% of pixels off by more than 40 (the add-ons' shadows on the frame itself).
- Packed: frames 20-34 KB AVIF / 30-45 KB WebP each, overlays 2-4 KB; empty view 30 KB AVIF. 964 KB in total.
- Screenshots and sheets (box-local, untracked): `e2e/.shots/*-{390,1440}[-preview].png`, `contact-{390,1440}.png`,
  `compare-vs-reference.png`.
