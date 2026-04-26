/**
 * fetch-clips — scarica video YouTube via yt-dlp e crea N clip 1080x1920 5.5s in
 * videos/<slug>/clips/01..NN.mp4. Usa una lista di query, distribuisce i clip
 * sui video scaricati (3-5 segmenti per video, presi a tempi casuali ben distribuiti).
 *
 * Standalone, non dipende da OpenRouter né da altre API.
 *
 * Uso interno: usato dallo script ad-hoc per generare proof-of-concept clip
 * quando non si hanno clip da meta.ai. Per produzione vera, generare i clip
 * a mano su meta.ai seguendo i prompts.md del singolo video.
 */
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, existsSync, unlinkSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {path as ffprobePath} from '@ffprobe-installer/ffprobe';
import {YTDLP} from './_ytdlp.mjs';

export async function fetchClipsForVideo({
  slug,
  queries,
  totalClips,
  clipDuration = 5.5,
  root = process.cwd(),
}) {
  const VIDEO_DIR = path.join(root, 'videos', slug);
  const CLIPS_DIR = path.join(VIDEO_DIR, 'clips');
  const CACHE_DIR = path.join(root, 'cache', 'video', slug);
  mkdirSync(CLIPS_DIR, {recursive: true});
  mkdirSync(CACHE_DIR, {recursive: true});

  const clipsPerQuery = Math.ceil(totalClips / queries.length);
  const downloaded = [];

  for (const q of queries) {
    const safeQ = q.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const cached = path.join(CACHE_DIR, `${safeQ}.mp4`);
    if (existsSync(cached) && statSync(cached).size > 1_000_000) {
      console.log(`  [cache] ${q}`);
      downloaded.push({path: cached, query: q});
      continue;
    }
    console.log(`  [yt-dlp] ${q}`);
    const args = [
      `ytsearch1:${q}`,
      '-f', 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
      '--match-filter', 'duration>40 & duration<3000',
      '--no-playlist',
      '--no-warnings',
      '-o', cached,
      '--no-write-info-json',
      '--no-write-thumbnail',
      '--socket-timeout', '20',
    ];
    const r = spawnSync(YTDLP, args, {stdio: 'inherit', timeout: 180_000});
    if (r.status === 0 && existsSync(cached)) {
      downloaded.push({path: cached, query: q});
    } else {
      console.warn(`    ✗ skip "${q}"`);
    }
  }

  if (downloaded.length === 0) throw new Error('Nessun video scaricato');

  // Estrai segmenti
  let clipIdx = 1;
  for (const {path: srcPath, query} of downloaded) {
    if (clipIdx > totalClips) break;
    const probe = spawnSync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      srcPath,
    ]);
    const dur = parseFloat(probe.stdout.toString().trim());
    if (!dur || dur < clipDuration * 2) continue;

    // Quanti segmenti estrarre da questo video
    const remaining = totalClips - clipIdx + 1;
    const queryPos = downloaded.indexOf(downloaded.find((d) => d.path === srcPath));
    const queriesLeft = downloaded.length - queryPos;
    const segments = Math.min(clipsPerQuery + 1, Math.ceil(remaining / queriesLeft));

    // Posizioni casuali ben distribuite, evitando 15s iniziali e 10s finali
    const usableStart = 15;
    const usableEnd = Math.max(usableStart + clipDuration, dur - 10);
    const startTimes = [];
    for (let s = 0; s < segments; s++) {
      const slot = (usableEnd - usableStart) / segments;
      const t = usableStart + slot * s + Math.random() * (slot - clipDuration);
      startTimes.push(Math.max(usableStart, Math.min(t, dur - clipDuration - 1)));
    }

    for (const start of startTimes) {
      if (clipIdx > totalClips) break;
      const out = path.join(CLIPS_DIR, String(clipIdx).padStart(2, '0') + '.mp4');
      console.log(`  [clip ${String(clipIdx).padStart(2, '0')}] ${query} @ ${start.toFixed(1)}s`);
      const r = spawnSync(ffmpegPath, [
        '-y',
        '-ss', start.toFixed(2),
        '-i', srcPath,
        '-t', String(clipDuration),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-an',
        out,
      ], {stdio: ['ignore', 'ignore', 'inherit']});
      if (r.status === 0) clipIdx++;
    }
  }

  return clipIdx - 1;
}
