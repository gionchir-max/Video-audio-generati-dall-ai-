#!/usr/bin/env python3
"""
Multilingual TTS via splicing for Edge TTS.

Generates VO with a pure Italian voice (clean Italian pronunciation), then
replaces foreign-language terms (brand names, proper nouns) with audio from
a dedicated voice for that language. Splicing happens at word-boundary
timestamps from edge-tts WordBoundary mode.

Why: it-IT-GiuseppeMultilingualNeural mispronounces less-common Italian words
(auto-detect bias toward English). it-IT-DiegoNeural is pure Italian (clean)
but mispronounces English brands. Two-pass splicing gives best of both.

Usage:
  python3 _tts-multilingual.py --story PATH --voice VOICE --rate +7% --out OUT
                               [--foreign-terms PATH_OR_INLINE_JSON]
                               [--voice-en VOICE] [--voice-de VOICE] [--voice-fr VOICE]
"""
import argparse, asyncio, json, os, re, sys, tempfile
from pathlib import Path
import edge_tts
from pydub import AudioSegment

# Use ffmpeg-static from npm
ROOT = Path(__file__).resolve().parent.parent
FFMPEG_STATIC = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg"
if FFMPEG_STATIC.exists():
    AudioSegment.converter = str(FFMPEG_STATIC)
    AudioSegment.ffmpeg = str(FFMPEG_STATIC)

DEFAULT_VOICES = {
    "en-US": "en-US-AndrewNeural",
    "de-DE": "de-DE-ConradNeural",
    "fr-FR": "fr-FR-HenriNeural",
    "es-ES": "es-ES-AlvaroNeural",
}


async def synth_with_boundaries(text, voice, rate):
    audio_chunks = []
    boundaries = []
    c = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    async for chunk in c.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            boundaries.append({
                "offset_ms": chunk["offset"] / 10000,
                "duration_ms": chunk["duration"] / 10000,
                "text": chunk["text"],
            })
    return b"".join(audio_chunks), boundaries


async def synth_simple(text, voice, rate):
    audio_chunks = []
    c = edge_tts.Communicate(text, voice, rate=rate)
    async for chunk in c.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
    return b"".join(audio_chunks)


def normalize_word(w):
    return re.sub(r"[^\wÀ-ÿ']+", "", w, flags=re.UNICODE).lower()


def find_term_ranges(boundaries, term):
    """Locate occurrences of `term` (multi-word) in word boundaries.
    Returns list of (start_ms, end_ms)."""
    term_words = [normalize_word(w) for w in term.split() if w.strip()]
    if not term_words:
        return []
    n = len(term_words)
    ranges = []
    for i in range(len(boundaries) - n + 1):
        candidate = [normalize_word(boundaries[i + j]["text"]) for j in range(n)]
        if candidate == term_words:
            start = boundaries[i]["offset_ms"]
            end = boundaries[i + n - 1]["offset_ms"] + boundaries[i + n - 1]["duration_ms"]
            ranges.append((start, end))
    return ranges


def write_temp_audio(audio_bytes):
    f = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    f.write(audio_bytes)
    f.close()
    return f.name


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--story", required=True)
    p.add_argument("--voice", required=True, help="Italian voice, e.g. it-IT-DiegoNeural")
    p.add_argument("--rate", default="+0%")
    p.add_argument("--out", required=True)
    p.add_argument("--foreign-terms", default="{}",
                   help="Path to JSON file or inline JSON: {\"en-US\":[...],\"de-DE\":[...]}")
    p.add_argument("--voice-en", default=DEFAULT_VOICES["en-US"])
    p.add_argument("--voice-de", default=DEFAULT_VOICES["de-DE"])
    p.add_argument("--voice-fr", default=DEFAULT_VOICES["fr-FR"])
    p.add_argument("--voice-es", default=DEFAULT_VOICES["es-ES"])
    args = p.parse_args()

    text = Path(args.story).read_text(encoding="utf-8")

    # Parse foreign terms (file path or inline JSON)
    if os.path.exists(args.foreign_terms):
        foreign = json.loads(Path(args.foreign_terms).read_text(encoding="utf-8"))
    else:
        foreign = json.loads(args.foreign_terms)

    voice_for_lang = {
        "en-US": args.voice_en,
        "de-DE": args.voice_de,
        "fr-FR": args.voice_fr,
        "es-ES": args.voice_es,
    }

    print(f"[tts-ml] Generating Italian VO with {args.voice} rate={args.rate}", flush=True)
    main_bytes, boundaries = await synth_with_boundaries(text, args.voice, args.rate)
    main_path = write_temp_audio(main_bytes)
    main_audio = AudioSegment.from_mp3(main_path)
    print(f"[tts-ml] Main audio: {len(main_audio)/1000:.2f}s, {len(boundaries)} word boundaries", flush=True)

    # Build replacements
    replacements = []  # list of (start_ms, end_ms, AudioSegment)
    skipped = []
    for lang, terms in foreign.items():
        voice_lang = voice_for_lang.get(lang)
        if not voice_lang:
            print(f"[tts-ml] WARN: no voice for lang {lang}, skipping its terms", flush=True)
            continue
        for term in terms:
            ranges = find_term_ranges(boundaries, term)
            if not ranges:
                print(f"[tts-ml] WARN: term '{term}' not found in boundaries", flush=True)
                skipped.append(term)
                continue
            print(f"[tts-ml]   '{term}' ({lang}, {voice_lang}): {len(ranges)} occurrence(s)", flush=True)
            term_bytes = await synth_simple(term, voice_lang, args.rate)
            term_path = write_temp_audio(term_bytes)
            term_audio = AudioSegment.from_mp3(term_path)
            os.unlink(term_path)
            for start, end in ranges:
                replacements.append((start, end, term_audio, term, lang))

    # Splice in chronological order
    replacements.sort(key=lambda r: r[0])

    # Detect and drop overlapping replacements (longest term wins per zone)
    deduped = []
    for r in replacements:
        if deduped and r[0] < deduped[-1][1]:
            # Overlap: prefer the longer term (more specific)
            if (r[1] - r[0]) > (deduped[-1][1] - deduped[-1][0]):
                deduped[-1] = r
        else:
            deduped.append(r)
    replacements = deduped

    if not replacements:
        print("[tts-ml] No replacements applied; saving main audio as-is.", flush=True)
        main_audio.export(args.out, format="mp3", bitrate="128k")
    else:
        parts = []
        cursor = 0
        for start, end, repl, term, lang in replacements:
            parts.append(main_audio[cursor:int(start)])
            parts.append(repl)
            cursor = int(end)
        parts.append(main_audio[cursor:])
        final = parts[0]
        for part in parts[1:]:
            final = final + part
        final.export(args.out, format="mp3", bitrate="128k")
        out_dur = len(final) / 1000
        print(f"[tts-ml] Spliced {len(replacements)} segment(s); output {out_dur:.2f}s", flush=True)

    os.unlink(main_path)
    if skipped:
        print(f"[tts-ml] WARN: {len(skipped)} term(s) skipped (not found): {skipped}", flush=True)
        sys.exit(2)  # non-zero exit but file is written; caller can decide
    print(f"[tts-ml] DONE → {args.out}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
