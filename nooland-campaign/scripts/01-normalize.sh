#!/usr/bin/env bash
# Normalizza i 6 clip di un video a 1080x1920 / 30fps / 5s esatti, nessun audio.
#
# Usage: ./01-normalize.sh <slug>
# Esempio: ./01-normalize.sh v13-fuori-sede-A
#
# Input:  ../videos/<slug>/clips/{01..06}.mp4
# Output: ../videos/<slug>/normalized/{01..06}.mp4

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

SLUG="${1:-}"
[[ -z "$SLUG" ]] && { echo "Usage: $0 <slug>"; exit 1; }

CLIPS_DIR="$ROOT/videos/$SLUG/clips"
OUT_DIR="$ROOT/videos/$SLUG/normalized"

[[ -d "$CLIPS_DIR" ]] || { echo "MANCA $CLIPS_DIR"; exit 1; }
mkdir -p "$OUT_DIR"

for i in 01 02 03 04 05 06; do
  IN="$CLIPS_DIR/${i}.mp4"
  OUT="$OUT_DIR/${i}.mp4"

  if [[ ! -f "$IN" ]]; then
    echo "[skip $SLUG] $IN non trovato"
    continue
  fi

  echo "[normalize $SLUG] ${i}.mp4"
  ffmpeg -y -i "$IN" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1" \
    -t 5 \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
    -an \
    "$OUT" 2>&1 | tail -3
done

echo "[done] $SLUG normalized"
