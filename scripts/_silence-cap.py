#!/usr/bin/env python3
"""
_silence-cap.py — cap dei silenzi in un audio mantenendo respiri naturali.

Uso:
    python3 _silence-cap.py <input> <output> [--detect-dur 0.4] [--cap-dur 0.2] [--threshold -40]

Strategia:
    1. ffmpeg silencedetect rileva silenzi più lunghi di --detect-dur
    2. Per ogni silenzio: sostituisce con silenzio fisso di --cap-dur (default 0.2s)
    3. Silenzi più corti di --detect-dur restano invariati (respiri naturali)

Diversa da silenceremove (che li rimuove COMPLETAMENTE).
"""
import sys, re, subprocess, argparse, os

def ffprobe_duration(path, ffprobe_bin):
    r = subprocess.run([ffprobe_bin, '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'default=nw=1:nk=1', path], capture_output=True, text=True)
    return float(r.stdout.strip())

def detect_silences(path, ffmpeg_bin, threshold_db, min_dur):
    """Restituisce lista di {start, end, dur} per silenzi > min_dur"""
    r = subprocess.run([ffmpeg_bin, '-i', path, '-af',
                        f'silencedetect=noise={threshold_db}dB:d={min_dur}',
                        '-f', 'null', '-'], capture_output=True, text=True)
    silences = []
    starts = re.findall(r'silence_start: ([\d.]+)', r.stderr)
    ends_durs = re.findall(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)', r.stderr)
    for s, (e, d) in zip(starts, ends_durs):
        silences.append({'start': float(s), 'end': float(e), 'dur': float(d)})
    return silences

def cap_silences(input_path, output_path, ffmpeg_bin, ffprobe_bin,
                 detect_dur=0.4, cap_dur=0.2, threshold_db=-40):
    silences = detect_silences(input_path, ffmpeg_bin, threshold_db, detect_dur)
    total_dur = ffprobe_duration(input_path, ffprobe_bin)

    if not silences:
        print(f'  Nessun silenzio > {detect_dur}s, copia tale e quale')
        subprocess.run([ffmpeg_bin, '-y', '-i', input_path, '-c', 'copy', output_path], check=True)
        return total_dur

    # Costruisco i segmenti audio "tra-i-silenzi-lunghi"
    # Tra ogni segmento metto un silenzio di cap_dur
    audio_segs = []  # (start_s, end_s) in input
    prev_end = 0.0
    for s in silences:
        # Includo nel segmento anche un piccolo padding del silenzio originale (cap_dur), così non taglio bruscamente
        # In realtà lascio che il cap_dur sia interamente "silenzio inserito"
        if s['start'] > prev_end:
            audio_segs.append((prev_end, s['start']))
        prev_end = s['end']
    if prev_end < total_dur:
        audio_segs.append((prev_end, total_dur))

    n = len(audio_segs)
    print(f'  {len(silences)} silenzi >{detect_dur}s → {n} segmenti, gap fisso {cap_dur}s')

    # filter_complex: estrai ogni segmento, intervalla con un silenzio cap_dur, concat
    parts = []
    for i, (s, e) in enumerate(audio_segs):
        parts.append(f'[0:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS[seg{i}]')

    # Per N segmenti servono N-1 silenzi di gap. Genera anullsrc + asplit in N-1 copie
    n_gaps = n - 1
    if n_gaps > 0:
        sil_outputs = ''.join(f'[sil{i}]' for i in range(n_gaps))
        parts.append(
            f'anullsrc=channel_layout=mono:sample_rate=24000,'
            f'atrim=duration={cap_dur},asetpts=PTS-STARTPTS,asplit={n_gaps}{sil_outputs}'
        )

    # Concat chain: seg0 sil0 seg1 sil1 ... seg(N-1)
    chain = ''
    nstreams = 0
    for i in range(n):
        chain += f'[seg{i}]'
        nstreams += 1
        if i < n - 1:
            chain += f'[sil{i}]'
            nstreams += 1
    parts.append(f'{chain}concat=n={nstreams}:v=0:a=1[out]')
    filter_complex = ';'.join(parts)

    cmd = [ffmpeg_bin, '-y', '-i', input_path, '-filter_complex', filter_complex,
           '-map', '[out]', '-ar', '48000', '-ac', '2', '-b:a', '192k', output_path]
    subprocess.run(cmd, check=True, capture_output=True)
    new_dur = ffprobe_duration(output_path, ffprobe_bin)
    saved = total_dur - new_dur
    print(f'  {total_dur:.2f}s → {new_dur:.2f}s (-{saved:.2f}s, -{saved/total_dur*100:.1f}%)')
    return new_dur

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('input')
    p.add_argument('output')
    p.add_argument('--detect-dur', type=float, default=0.4, help='Silence detection threshold (default 0.4s)')
    p.add_argument('--cap-dur', type=float, default=0.2, help='Cap silence to this duration (default 0.2s)')
    p.add_argument('--threshold', type=float, default=-40, help='dB threshold for silence (default -40)')
    p.add_argument('--ffmpeg', default=os.environ.get('FFMPEG', 'ffmpeg'))
    p.add_argument('--ffprobe', default=os.environ.get('FFPROBE', 'ffprobe'))
    args = p.parse_args()
    cap_silences(args.input, args.output, args.ffmpeg, args.ffprobe,
                 args.detect_dur, args.cap_dur, args.threshold)
