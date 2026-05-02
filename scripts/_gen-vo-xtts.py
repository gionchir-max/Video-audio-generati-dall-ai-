#!/usr/bin/env python3
"""Genera voiceover.mp3 con Coqui XTTS v2 italiano - testo già pre-formattato in story-xtts.txt."""
import os, re, glob, subprocess, sys
from pathlib import Path

# Patches
import transformers.pytorch_utils as p
import torch
if not hasattr(p, 'isin_mps_friendly'):
    p.isin_mps_friendly = torch.isin

os.environ['COQUI_TOS_AGREED'] = '1'
from TTS.api import TTS

ROOT = Path('/Volumes/Extreme SSD/Video Claude/tiktok-city/videos/schumacher')
STORY_PATH = ROOT / 'story-xtts.txt'
STORY = STORY_PATH.read_text()
OUT_DIR = ROOT / 'audio' / 'wav_chunks'
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_MP3 = ROOT / 'audio' / 'voiceover-v2.mp3'

# Speaker e velocità
SPEAKER = sys.argv[1] if len(sys.argv) > 1 else 'Damien Black'
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
LANG = 'it'
DEVICE = 'mps' if torch.backends.mps.is_available() else 'cpu'
print(f'Device: {DEVICE}, Speaker: {SPEAKER}, Lang: {LANG}, Speed: {SPEED}')

# Read story riga per riga (già pre-formattato per XTTS, una frase per riga)
chunks = [line.strip() for line in STORY.split('\n') if line.strip()]
print(f'{len(chunks)} chunks da sintetizzare')

# Carica modello
print('Loading XTTS v2...')
tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to(DEVICE)
print('Model loaded')

# Sintesi per chunk
for i, c in enumerate(chunks):
    out_wav = OUT_DIR / f'{i:03d}.wav'
    if out_wav.exists() and out_wav.stat().st_size > 1000:
        continue
    print(f'[{i+1}/{len(chunks)}] {c[:80]}...')
    try:
        tts.tts_to_file(text=c, speaker=SPEAKER, language=LANG, file_path=str(out_wav), speed=SPEED)
    except Exception as e:
        print(f'  ERROR: {e}')

# Concat con ffmpeg
wavs = sorted(OUT_DIR.glob('*.wav'))
list_path = OUT_DIR / 'list.txt'
list_path.write_text('\n'.join(f"file '{w}'" for w in wavs))

print(f'\nConcat {len(wavs)} chunk in {OUT_MP3}')
subprocess.run([
    'ffmpeg', '-y', '-f', 'concat', '-safe', '0',
    '-i', str(list_path),
    '-c:a', 'libmp3lame', '-b:a', '192k',
    str(OUT_MP3)
], check=True, capture_output=True)

# Stats
sz = OUT_MP3.stat().st_size // 1024
dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(OUT_MP3)], capture_output=True, text=True).stdout.strip()
print(f'\n✓ {OUT_MP3} pronto ({sz} KB, {dur}s)')
