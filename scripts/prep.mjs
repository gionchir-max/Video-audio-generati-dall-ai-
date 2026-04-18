import ffmpegPath from 'ffmpeg-static';
import {path as ffprobePath} from '@ffprobe-installer/ffprobe';
import {spawn} from 'node:child_process';
import {mkdirSync, existsSync, unlinkSync, writeFileSync, readFileSync, copyFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'out');
const CACHE_TTS = path.join(ROOT, 'cache', 'tts');
const CACHE_VOICE = path.join(ROOT, 'cache', 'voice');
mkdirSync(PUBLIC, {recursive: true});
mkdirSync(CACHE_VOICE, {recursive: true});

const VOICE_RAW = path.join(OUT, 'voiceover-raw.mp3');
const VOICE_RAW_SLUG = VOICE_RAW + '.slug';
const VOICE_CLEAN = path.join(PUBLIC, 'voiceover.mp3');
const VOICE_CLEAN_SLUG = VOICE_CLEAN + '.slug';
const BG_MP4 = path.join(PUBLIC, 'bg.mp4');
const META_JSON = path.join(ROOT, 'src', 'meta.json');
const SCRIPT_META = path.join(OUT, 'script.meta.json');

function currentSlug() {
  if (!existsSync(SCRIPT_META)) return '';
  try {
    return JSON.parse(readFileSync(SCRIPT_META, 'utf8')).slug || '';
  } catch {
    return '';
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve({out, err}) : reject(new Error(`${cmd} exit ${code}: ${err}`))));
  });
}

async function probeDuration(file) {
  const {out} = await run(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return parseFloat(out.trim());
}

async function main() {
  const slug = currentSlug();

  // Se voiceover-raw.mp3 è stato clobberato da un run concorrente, ripristina dalla cache per-slug.
  const rawSlug = existsSync(VOICE_RAW_SLUG) ? readFileSync(VOICE_RAW_SLUG, 'utf8').trim() : '';
  if (slug && rawSlug && rawSlug !== slug) {
    const cached = path.join(CACHE_TTS, `${slug}.mp3`);
    if (existsSync(cached)) {
      copyFileSync(cached, VOICE_RAW);
      writeFileSync(VOICE_RAW_SLUG, slug);
      console.log(`[prep] voiceover-raw.mp3 era "${rawSlug}", ripristino da cache/tts/${slug}.mp3`);
    } else {
      throw new Error(
        `voiceover-raw.mp3 è di slug "${rawSlug}" ma questo run è "${slug}", e cache/tts/${slug}.mp3 non esiste. Rilancia tts con --force.`,
      );
    }
  }

  if (!existsSync(VOICE_RAW)) {
    console.error(`[prep] ${VOICE_RAW} non trovato — esegui prima \`npm run tts\``);
    process.exit(1);
  }

  // Short-circuit: se il clean esiste già per questo slug (non clobberato), lo consideriamo ok
  // e procediamo solo a ricalcolare meta (per aggiornare videoDuration).
  const cleanSlug = existsSync(VOICE_CLEAN_SLUG) ? readFileSync(VOICE_CLEAN_SLUG, 'utf8').trim() : '';
  const cachedClean = slug ? path.join(CACHE_VOICE, `${slug}.mp3`) : '';
  if (slug && cleanSlug !== slug && cachedClean && existsSync(cachedClean)) {
    copyFileSync(cachedClean, VOICE_CLEAN);
    writeFileSync(VOICE_CLEAN_SLUG, slug);
    console.log(`[prep] voiceover.mp3 era "${cleanSlug || '?'}", ripristino da cache/voice/${slug}.mp3`);
  }

  console.log('[prep] rimuovo silenzi > 0.2s dal voiceover...');
  if (existsSync(VOICE_CLEAN)) unlinkSync(VOICE_CLEAN);
  await run(ffmpegPath, [
    '-y',
    '-i', VOICE_RAW,
    '-af',
    'silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-35dB:start_periods=1:start_duration=0.05:start_threshold=-35dB,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar', '48000',
    '-ac', '2',
    VOICE_CLEAN,
  ]);

  const origDur = await probeDuration(VOICE_RAW);
  const cleanDur = await probeDuration(VOICE_CLEAN);
  console.log(`[prep] voiceover: ${origDur.toFixed(2)}s → ${cleanDur.toFixed(2)}s (−${(origDur - cleanDur).toFixed(2)}s)`);

  let videoDur = 0;
  if (existsSync(BG_MP4)) {
    videoDur = await probeDuration(BG_MP4);
    console.log(`[prep] bg.mp4: ${videoDur.toFixed(2)}s`);
  } else {
    console.log('[prep] bg.mp4 non presente (verrà generato da `download` in base alla durata del voiceover)');
  }

  const meta = {
    voiceoverDuration: cleanDur,
    videoDuration: videoDur,
    fps: 30,
  };
  writeFileSync(META_JSON, JSON.stringify(meta, null, 2));

  // Marca lo slug e cache il clean per poter ripristinare in caso di clobber da run concorrente.
  if (slug) {
    writeFileSync(VOICE_CLEAN_SLUG, slug);
    copyFileSync(VOICE_CLEAN, path.join(CACHE_VOICE, `${slug}.mp3`));
  }
  console.log(`[prep] → src/meta.json${slug ? ` · slug="${slug}"` : ''}`);
}

main().catch((e) => {
  console.error('[prep]', e.message);
  process.exit(1);
});
