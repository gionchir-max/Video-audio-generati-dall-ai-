#!/usr/bin/env bash
# Concatena i 6 clip normalizzati con xfade 0.4s, mixa musica + VO,
# esporta clean.mp4 (NO TESTI, NO CTA — quelli li aggiunge Remotion dopo).
#
# Usage: ./02-merge-clean.sh <slug>
# Esempio: ./02-merge-clean.sh v13-fuori-sede-A
#
# Input:
#   ../videos/<slug>/normalized/{01..06}.mp4
#   ../videos/<slug>/props.json (contiene musicTrack, opzionalmente voFile)
#   ../audio/music-library/<musicTrack>
#   ../audio/vo/<slug>.mp3 (opzionale)
#
# Output: ../../public/nooland-campaign/<slug>/clean.mp4 (30s, 1080x1920, 30fps)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
PROJECT_ROOT="$ROOT/.."

SLUG="${1:-}"
[[ -z "$SLUG" ]] && { echo "Usage: $0 <slug>"; exit 1; }

NORM_DIR="$ROOT/videos/$SLUG/normalized"
PROPS="$ROOT/videos/$SLUG/props.json"
PUBLIC_OUT_DIR="$PROJECT_ROOT/public/nooland-campaign/$SLUG"
OUT="$PUBLIC_OUT_DIR/clean.mp4"

[[ -f "$PROPS" ]] || { echo "MANCA $PROPS"; exit 1; }

for i in 01 02 03 04 05 06; do
  [[ -f "$NORM_DIR/${i}.mp4" ]] || { echo "MANCA $NORM_DIR/${i}.mp4 — esegui prima ./01-normalize.sh $SLUG"; exit 1; }
done

# Estrai musicTrack da props.json (Node è sempre presente nel progetto)
MUSIC_TRACK=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROPS','utf8')).musicTrack || '')")
[[ -n "$MUSIC_TRACK" ]] || { echo "props.json deve contenere musicTrack"; exit 1; }

MUSIC="$ROOT/audio/music-library/$MUSIC_TRACK"
[[ -f "$MUSIC" ]] || { echo "MANCA $MUSIC (controlla audio/music-library/)"; exit 1; }

VO="$ROOT/audio/vo/$SLUG.mp3"
HAS_VO=0
[[ -f "$VO" ]] && HAS_VO=1

mkdir -p "$PUBLIC_OUT_DIR"

# xfade offsets per 6 clip da 5s con 0.4s di transizione: 4.6, 9.2, 13.8, 18.4, 23.0
FILTER_VIDEO="[0:v][1:v]xfade=transition=fade:duration=0.4:offset=4.6[v01];\
[v01][2:v]xfade=transition=fade:duration=0.4:offset=9.2[v012];\
[v012][3:v]xfade=transition=fade:duration=0.4:offset=13.8[v0123];\
[v0123][4:v]xfade=transition=fade:duration=0.4:offset=18.4[v01234];\
[v01234][5:v]xfade=transition=fade:duration=0.4:offset=23.0[vout]"

if [[ $HAS_VO -eq 1 ]]; then
  echo "[merge $SLUG] musica + VO"
  ffmpeg -y \
    -i "$NORM_DIR/01.mp4" -i "$NORM_DIR/02.mp4" -i "$NORM_DIR/03.mp4" \
    -i "$NORM_DIR/04.mp4" -i "$NORM_DIR/05.mp4" -i "$NORM_DIR/06.mp4" \
    -i "$MUSIC" -i "$VO" \
    -filter_complex "${FILTER_VIDEO};\
[6:a]volume=0.18,atrim=0:30,asetpts=PTS-STARTPTS[bg];\
[7:a]volume=1.4,atrim=0:30,asetpts=PTS-STARTPTS[vo];\
[bg][vo]amix=inputs=2:duration=first:dropout_transition=0[aout]" \
    -map "[vout]" -map "[aout]" \
    -t 30 \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
    -c:a aac -b:a 192k \
    -movflags +faststart \
    "$OUT" 2>&1 | tail -5
else
  echo "[merge $SLUG] solo musica (vo.mp3 non trovato)"
  ffmpeg -y \
    -i "$NORM_DIR/01.mp4" -i "$NORM_DIR/02.mp4" -i "$NORM_DIR/03.mp4" \
    -i "$NORM_DIR/04.mp4" -i "$NORM_DIR/05.mp4" -i "$NORM_DIR/06.mp4" \
    -i "$MUSIC" \
    -filter_complex "${FILTER_VIDEO};\
[6:a]volume=0.6,atrim=0:30,asetpts=PTS-STARTPTS[aout]" \
    -map "[vout]" -map "[aout]" \
    -t 30 \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
    -c:a aac -b:a 192k \
    -movflags +faststart \
    "$OUT" 2>&1 | tail -5
fi

echo "[done] $OUT"
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of default=nw=1 "$OUT" 2>&1 || true
