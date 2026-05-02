#!/usr/bin/env python3
"""Whisper QA loop: trascrive ogni chunk wav, confronta con testo expected, rigenera i problematici."""
import os, re, sys, subprocess
from pathlib import Path
from difflib import SequenceMatcher

# Patches
import transformers.pytorch_utils as p
import torch
if not hasattr(p, 'isin_mps_friendly'):
    p.isin_mps_friendly = torch.isin

os.environ['COQUI_TOS_AGREED'] = '1'
from TTS.api import TTS
from faster_whisper import WhisperModel

ROOT = Path('/Volumes/Extreme SSD/Video Claude/tiktok-city/videos/schumacher')
STORY = (ROOT / 'story.txt').read_text()
WAV_DIR = ROOT / 'audio' / 'wav_chunks'
OUT_MP3 = ROOT / 'audio' / 'voiceover-v2.mp3'

def clean(t):
    t = t.replace('...', '. ').replace('…', '. ')
    t = t.replace('"', '').replace('"', '').replace('"', '').replace("'", "'")
    t = t.replace(':', '.').replace(';', ',').replace('—', ',').replace('–', ',')
    t = re.sub(r'\s+', ' ', t)
    return t.strip()

def normalize(t):
    """Per il match: lowercase, no punctuation, no extra spaces."""
    t = t.lower()
    t = re.sub(r"[^\w\sàèéìíòóùú]", ' ', t)
    t = re.sub(r'\s+', ' ', t)
    return t.strip()

STORY = clean(STORY)
paras = [p.strip() for p in STORY.split('\n\n') if p.strip()]
chunks = []
for para in paras:
    if len(para) <= 250:
        chunks.append(para)
    else:
        cur = ''
        for s in re.split(r'(?<=[.!?])\s+', para):
            if len(cur) + len(s) + 1 <= 250:
                cur = (cur + ' ' + s).strip()
            else:
                if cur: chunks.append(cur)
                cur = s
        if cur: chunks.append(cur)
print(f'{len(chunks)} chunks expected')

# Whisper model — large-v3 italiano per max accuracy
print('Loading Whisper large-v3...')
DEVICE_W = 'cpu'  # MPS non supportato da faster-whisper, CPU su M4 è veloce
whisper = WhisperModel('large-v3', device=DEVICE_W, compute_type='int8')
print('Whisper loaded')

THRESHOLD = float(sys.argv[1]) if len(sys.argv) > 1 else 0.85
print(f'Threshold accuracy: {THRESHOLD}')

bad_chunks = []
for i, expected in enumerate(chunks):
    wav_path = WAV_DIR / f'{i:03d}.wav'
    if not wav_path.exists():
        bad_chunks.append((i, expected, 'MISSING'))
        continue
    segments, _ = whisper.transcribe(str(wav_path), language='it', beam_size=5)
    transcribed = ' '.join(s.text.strip() for s in segments)
    e_norm = normalize(expected)
    t_norm = normalize(transcribed)
    sim = SequenceMatcher(None, e_norm, t_norm).ratio()
    status = '✓' if sim >= THRESHOLD else '✗'
    print(f'{status} [{i:03d}] sim={sim:.2f}')
    if sim < THRESHOLD:
        print(f'    EXPECT: {expected[:120]}')
        print(f'    GOT:    {transcribed[:120]}')
        bad_chunks.append((i, expected, transcribed))

print(f'\n=== {len(bad_chunks)} chunks below threshold ===')
if not bad_chunks:
    print('✓ TUTTI I CHUNKS PASSANO. Concat finale...')
else:
    print('Rigenero chunks problematici con XTTS...')
    print('Loading XTTS v2...')
    tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to('mps' if torch.backends.mps.is_available() else 'cpu')
    SPEAKER = 'Damien Black'
    for idx, exp, got in bad_chunks:
        if got == 'MISSING':
            continue
        wav = WAV_DIR / f'{idx:03d}.wav'
        print(f'  [{idx:03d}] regen')
        tts.tts_to_file(text=exp, speaker=SPEAKER, language='it', file_path=str(wav), speed=1.2)

# Concat (anche dopo rigenerazione)
import glob
wavs = sorted(WAV_DIR.glob('*.wav'))
list_path = WAV_DIR / 'list.txt'
list_path.write_text('\n'.join(f"file '{w}'" for w in wavs))
RAW = ROOT / 'audio' / 'voiceover-v2-raw.mp3'
subprocess.run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(list_path),'-c:a','libmp3lame','-b:a','192k',str(RAW)], check=True, capture_output=True)
# Silence trim
subprocess.run(['ffmpeg','-y','-i',str(RAW),'-af','silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-40dB','-ar','48000','-ac','2','-b:a','192k',str(OUT_MP3)], check=True, capture_output=True)

dur = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(OUT_MP3)], capture_output=True, text=True).stdout.strip()
sz = OUT_MP3.stat().st_size // 1024
print(f'\n✓ {OUT_MP3} pronto ({sz} KB, {dur}s, {len(bad_chunks)} regen)')
