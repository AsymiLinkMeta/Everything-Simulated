#!/usr/bin/env bash
# Pack studio renders (PNG from render_studio.py) into web assets:
#   public/rigs/es-<shot>.jpg  + es-<shot>-{640,1024,1600}.webp  (what <SiteImage> serves)
# Usage: scripts/rig3d/pack-renders.sh /path/to/renders [shot ...]
# Only the web outputs are committed; the PNGs stay out of the repo.
set -euo pipefail
src="${1:?render dir}"; shift || true
out="$(cd "$(dirname "$0")/../../public/rigs" && pwd)"
shots=("$@")
if [ ${#shots[@]} -eq 0 ]; then
  for f in "$src"/*.png; do shots+=("$(basename "${f%.png}")"); done
fi
for s in "${shots[@]}"; do
  png="$src/$s.png"
  [ -f "$png" ] || { echo "skip $s (no render)"; continue; }
  jpg="$out/es-$s.jpg"
  ffmpeg -v error -y -i "$png" -vf "scale='min(2400,iw)':-2" -q:v 3 "$jpg"
  for w in 640 1024 1600; do
    ffmpeg -v error -y -i "$jpg" -vf "scale='min($w,iw)':-2" -c:v libwebp -quality 74 -compression_level 6 "$out/es-$s-$w.webp"
  done
  echo "packed es-$s"
done
