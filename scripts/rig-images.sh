#!/usr/bin/env bash
# Regenerate the WebP variants used by <SiteImage> for every public/rigs/*.jpg.
# Run after adding or replacing a photo: scripts/rig-images.sh
set -euo pipefail
cd "$(dirname "$0")/../public/rigs"
for f in *.jpg; do
  b="${f%.jpg}"
  for w in 640 1024 1600; do
    ffmpeg -v error -y -i "$f" -vf "scale='min($w,iw)':-2" -c:v libwebp -quality 72 -compression_level 6 "$b-$w.webp"
  done
done
echo "WebP variants written for $(ls *.jpg | wc -l) photos"
