#!/usr/bin/env node
/**
 * make-video — pipeline end-to-end per un singolo video TikTok 1080x1920.
 *
 * INPUT (in `videos/<slug>/`):
 *   - story.txt       testo del voiceover (italiano, paragrafi separati da riga vuota)
 *   - meta.json       configurazione (banner, voce edge-tts, musica)
 *   - clips/01.mp4..NN.mp4  clip generati a mano (es. da meta.ai), 9:16, qualsiasi durata
 *
 * OUTPUT:
 *   - videos/<slug>/audio/voiceover.mp3   VO generato da edge-tts
 *   - videos/<slug>/bg.mp4                clip concatenati
 *   - videos/<slug>/out/final.mp4         video finale (1080x1920, h264+aac)
 *
 * USO:  node scripts/make-video.mjs <slug>
 *       npm run video <slug>
 *
 * REQUISITI:
 *   - edge-tts installato (`pip3 install --user edge-tts`)
 *   - ffmpeg/ffprobe disponibili (usa il binario `ffmpeg-static` da node_modules)
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  cpSync,
  readdirSync,
} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

import ffmpegStatic from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const slug = process.argv[2];
if (!slug || slug.startsWith('-')) {
  console.error('Usage: node scripts/make-video.mjs <slug>');
  console.error('Esempio: node scripts/make-video.mjs greene-seduzione');
  process.exit(1);
}

const VIDEO_DIR = path.join(ROOT, 'videos', slug);
const STORY_PATH = path.join(VIDEO_DIR, 'story.txt');
const META_PATH = path.join(VIDEO_DIR, 'meta.json');
const CLIPS_DIR = path.join(VIDEO_DIR, 'clips');
const AUDIO_DIR = path.join(VIDEO_DIR, 'audio');
const OUT_DIR = path.join(VIDEO_DIR, 'out');
const PUBLIC_DIR = path.join(ROOT, 'public', 'videos', slug);

if (!existsSync(VIDEO_DIR)) {
  console.error(`✗ Manca cartella ${VIDEO_DIR}`);
  console.error(`  Crea la cartella e mettici dentro story.txt + meta.json + clips/`);
  process.exit(1);
}
if (!existsSync(STORY_PATH)) {
  console.error(`✗ Manca ${STORY_PATH}`);
  process.exit(1);
}
if (!existsSync(META_PATH)) {
  console.error(`✗ Manca ${META_PATH}`);
  process.exit(1);
}
if (!existsSync(CLIPS_DIR)) {
  console.error(`✗ Manca cartella ${CLIPS_DIR} con i clip 01.mp4..NN.mp4`);
  process.exit(1);
}

const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
const VOICE = meta.voice ?? 'it-IT-GiuseppeMultilingualNeural';
const RATE = meta.rate ?? '+7%';
const BANNER_TEXT = meta.banner ?? 'TITOLO';
const BANNER_SECONDS = meta.bannerSeconds ?? 10;
const MUSIC_VOLUME = meta.musicVolume ?? 0.15;
const MUSIC = meta.music === null ? null : meta.music ?? 'music.mp3';

mkdirSync(AUDIO_DIR, {recursive: true});
mkdirSync(OUT_DIR, {recursive: true});
mkdirSync(PUBLIC_DIR, {recursive: true});

const VO_PATH = path.join(AUDIO_DIR, 'voiceover.mp3');
const BG_PATH = path.join(VIDEO_DIR, 'bg.mp4');
const FINAL_PATH = path.join(OUT_DIR, 'final.mp4');

const FFMPEG = ffmpegStatic;
const FFPROBE = ffprobeInstaller.path;

function findEdgeTts() {
  const candidates = [
    process.env.EDGE_TTS_PATH,
    path.join(os.homedir(), 'Library/Python/3.12/bin/edge-tts'),
    path.join(os.homedir(), '.local/bin/edge-tts'),
    '/usr/local/bin/edge-tts',
    '/opt/homebrew/bin/edge-tts',
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return 'edge-tts';
}
const EDGE_TTS = findEdgeTts();

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: 'inherit', ...opts});
    p.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${path.basename(cmd)} exit ${code}`)),
    );
  });
}

function ffprobeDuration(filePath) {
  const r = spawnSync(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  if (r.status !== 0) throw new Error(`ffprobe ${filePath} failed`);
  return parseFloat(r.stdout.toString().trim());
}

async function step1_VO() {
  console.log(`\n[1/4] edge-tts ${VOICE} (rate ${RATE}) → ${path.relative(ROOT, VO_PATH)}`);
  await run(EDGE_TTS, [
    '--voice', VOICE,
    '--rate', RATE,
    '--file', STORY_PATH,
    '--write-media', VO_PATH,
  ]);
  const dur = ffprobeDuration(VO_PATH);
  console.log(`    VO durata: ${dur.toFixed(2)}s`);
  return dur;
}

async function step2_concat() {
  const clips = readdirSync(CLIPS_DIR)
    .filter((f) => /^\d+\.mp4$/.test(f))
    .sort();
  if (clips.length === 0) {
    throw new Error(`Nessun clip in ${CLIPS_DIR} (servono 01.mp4, 02.mp4, ...)`);
  }
  console.log(`\n[2/4] normalize ${clips.length} clip → bg.mp4 (1080x1920, 30fps, h264)`);

  const NORM_DIR = path.join(CLIPS_DIR, 'normalized');
  mkdirSync(NORM_DIR, {recursive: true});
  for (const f of clips) {
    const src = path.join(CLIPS_DIR, f);
    const dst = path.join(NORM_DIR, f);
    if (existsSync(dst)) continue;
    await run(FFMPEG, [
      '-y', '-i', src,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-an',
      dst,
    ]);
  }

  const concatTxt = path.join(NORM_DIR, 'concat.txt');
  writeFileSync(
    concatTxt,
    clips.map((f) => `file '${path.join(NORM_DIR, f).replace(/'/g, "'\\''")}'`).join('\n'),
  );
  await run(FFMPEG, [
    '-y', '-f', 'concat', '-safe', '0',
    '-i', concatTxt,
    '-c', 'copy',
    BG_PATH,
  ]);
  const bgDur = ffprobeDuration(BG_PATH);
  console.log(`    bg.mp4 durata: ${bgDur.toFixed(2)}s`);
  return bgDur;
}

async function step2b_extendBgIfShort(bgDur, voDur) {
  // Se bg < VO, estendi con freeze frame dell'ultimo frame per coprire VO + 0.5s margine
  const target = voDur + 0.5;
  if (bgDur >= target) return bgDur;
  const padSec = (target - bgDur).toFixed(2);
  console.log(`\n[2b] bg (${bgDur.toFixed(2)}s) < VO (${voDur.toFixed(2)}s) → estendo con freeze finale di ${padSec}s`);
  const padded = path.join(VIDEO_DIR, 'bg.padded.mp4');
  await run(FFMPEG, [
    '-y', '-i', BG_PATH,
    '-vf', `tpad=stop_mode=clone:stop_duration=${padSec}`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-an',
    padded,
  ]);
  cpSync(padded, BG_PATH);
  const newDur = ffprobeDuration(BG_PATH);
  console.log(`    bg.mp4 nuova durata: ${newDur.toFixed(2)}s`);
  return newDur;
}

function step3_publish() {
  console.log(`\n[3/4] copy assets → public/videos/${slug}/`);
  cpSync(BG_PATH, path.join(PUBLIC_DIR, 'bg.mp4'));
  cpSync(VO_PATH, path.join(PUBLIC_DIR, 'voiceover.mp3'));
}

async function step4_render(durationSeconds) {
  console.log(`\n[4/4] Remotion render EdgeStory → ${path.relative(ROOT, FINAL_PATH)}`);
  const props = JSON.stringify({
    slug,
    bannerText: BANNER_TEXT,
    bannerSeconds: BANNER_SECONDS,
    musicVolume: MUSIC_VOLUME,
    music: MUSIC,
    durationSeconds,
  });
  await run('npx', [
    'remotion', 'render',
    'EdgeStory',
    FINAL_PATH,
    `--props=${props}`,
    '--concurrency=4',
  ], {cwd: ROOT});
}

async function main() {
  console.log(`▶ make-video ${slug}`);
  const voDur = await step1_VO();
  let bgDur = await step2_concat();
  bgDur = await step2b_extendBgIfShort(bgDur, voDur);
  step3_publish();
  const duration = Math.min(voDur, bgDur) + 0.5;
  await step4_render(duration);
  console.log(`\n✓ DONE → ${FINAL_PATH}`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
