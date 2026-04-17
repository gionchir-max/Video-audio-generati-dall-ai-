import 'dotenv/config';
import {spawn} from 'node:child_process';
import {mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync} from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {path as ffprobePath} from '@ffprobe-installer/ffprobe';
import {YTDLP} from './_ytdlp.mjs';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3.2';

const ROOT = path.resolve('.');
const PUBLIC = path.join(ROOT, 'public');
const CACHE = path.join(ROOT, 'cache', 'video');
const OUT = path.join(ROOT, 'out');
mkdirSync(PUBLIC, {recursive: true});
mkdirSync(CACHE, {recursive: true});
mkdirSync(OUT, {recursive: true});

const BG_MP4 = path.join(PUBLIC, 'bg.mp4');
const BG_URL_FILE = path.join(OUT, 'bg.url');
const META_JSON = path.join(ROOT, 'src', 'meta.json');

const topic = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ').trim();
const FORCE = process.argv.includes('--force');
const SKIP_FIRST = parseInt(process.argv.find((a) => a.startsWith('--skip='))?.split('=')[1] ?? '0', 10);
const urlArg = process.argv.find((a) => a.startsWith('--url='));
const URL_OVERRIDE = urlArg ? urlArg.slice('--url='.length) : (process.env.BG_URL ?? '');

if (!topic) {
  console.error('Usage: node scripts/download.mjs "<topic>"');
  process.exit(1);
}

// Canali "puliti" storicamente noti per drone footage senza watermark invadenti
const WHITELIST_CHANNELS = [
  'MTI Aerials',
  'Travel by Drone',
  '4K Relaxation Channel',
  'DroneSnap',
  'Drone Snap',
  'Relaxation Films',
  'Global Sky Visuals',
  'SkyLine Videos',
  'ViralHog',
  'Nature Relaxation Films',
  '4K Urban Life',
  'Aerial Italia',
];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe'], ...opts});
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

async function resolveDroneLocation(topic) {
  if (!OPENROUTER_API_KEY) {
    return {location: topic, query: `${topic} drone aerial 4k cinematic footage`};
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tiktok-city.local',
        'X-Title': 'tiktok-city',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        response_format: {type: 'json_object'},
        messages: [
          {
            role: 'system',
            content:
              'Data una frase (può essere il nome di una città, un evento storico, un fenomeno culturale, un aneddoto), restituisci il luogo fisico più riprendibile con un drone che meglio lo rappresenta. Deve essere una località reale ripresa dall\'alto (città, monumento, skyline, paesaggio). Rispondi SOLO con JSON {"location": "nome luogo in inglese ottimizzato per ricerca YouTube", "query": "<location> drone aerial 4k cinematic skyline no watermark"}. Se l\'input è già una città usa quella. Esempi: "Parigi e la Sindrome di Parigi" → {"location": "Paris France", "query": "Paris France drone aerial 4k cinematic skyline no watermark"}. "la caduta dell\'impero romano" → {"location": "Rome Italy Colosseum", "query": "Rome Italy drone aerial 4k Colosseum skyline"}. "Roma" → {"location": "Rome Italy", "query": "Rome Italy drone aerial 4k cinematic skyline"}.',
          },
          {role: 'user', content: topic},
        ],
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    if (parsed.location && parsed.query) return parsed;
  } catch (e) {
    console.warn(`[download] resolve location fallito: ${e.message}, uso topic raw`);
  }
  return {location: topic, query: `${topic} drone aerial 4k cinematic footage`};
}

async function ytSearch(query, minDuration, n = 25) {
  console.log(`[download] ricerca: "${query}" (min ${minDuration}s)`);
  const {out} = await run(YTDLP, [
    `ytsearch${n}:${query}`,
    '--match-filter', `duration>${minDuration} & duration<2400`,
    '--no-download',
    '--print', '%(id)s\t%(channel)s\t%(duration)s\t%(width)s\t%(height)s\t%(title)s',
    '--no-warnings',
    '--js-runtimes', 'node',
  ]);
  return out.trim().split('\n').filter(Boolean).map((line) => {
    const [id, channel, duration, width, height, ...titleParts] = line.split('\t');
    return {
      id,
      channel: channel || '',
      duration: parseFloat(duration),
      width: parseInt(width, 10) || 0,
      height: parseInt(height, 10) || 0,
      title: titleParts.join('\t'),
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

function pickBest(results, minDuration, skip = 0) {
  const scored = results
    .filter((r) => r.height >= 720 && r.duration >= minDuration)
    .map((r) => {
      let score = 0;
      const title = r.title.toLowerCase();
      const isDrone =
        title.includes('drone') ||
        title.includes('aerial') ||
        title.includes('4k') ||
        title.includes('cinematic');
      if (!isDrone) score -= 50;
      if (WHITELIST_CHANNELS.some((c) => r.channel.toLowerCase().includes(c.toLowerCase()))) score += 100;
      if (title.includes('drone')) score += 15;
      if (title.includes('aerial')) score += 10;
      if (r.height >= 2160) score += 10;
      else if (r.height >= 1080) score += 5;
      if (r.duration >= 180 && r.duration <= 900) score += 5;
      if (title.includes('no copyright') || title.includes('free')) score += 3;
      if (title.includes('watermark') || title.includes('logo')) score -= 10;
      if (title.includes('syndrome') || title.includes('documentary') || title.includes('vlog')) score -= 30;
      return {...r, score};
    })
    .sort((a, b) => b.score - a.score);
  return scored[skip] ?? scored[0] ?? null;
}

async function downloadVideo(videoId, neededSeconds) {
  // Cache tagged per durata richiesta: scaricamenti parziali diversi per neededSeconds diversi
  const tag = neededSeconds ? `_${Math.ceil(neededSeconds)}s` : '';
  const outTmpl = path.join(CACHE, `${videoId}${tag}.%(ext)s`);
  const existing = [`${videoId}${tag}.mp4`, `${videoId}${tag}.mkv`, `${videoId}${tag}.webm`]
    .map((f) => path.join(CACHE, f))
    .find((f) => existsSync(f));
  if (existing) {
    console.log(`[download] cache hit: ${existing}`);
    return existing;
  }
  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '-f', 'bestvideo[height>=1080][ext=mp4]+bestaudio/bestvideo[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '-o', outTmpl,
    '--no-warnings',
    '--quiet',
    '--js-runtimes', 'node',
  ];
  if (neededSeconds && neededSeconds > 0) {
    // Scarica solo 0..neededSeconds (yt-dlp richiede ffmpeg per il cut; lo forniamo esplicito)
    args.push('--download-sections', `*0-${Math.ceil(neededSeconds)}`);
    args.push('--ffmpeg-location', ffmpegPath);
    console.log(`[download] yt-dlp → ${videoId} (solo primi ${Math.ceil(neededSeconds)}s)`);
  } else {
    console.log(`[download] yt-dlp → ${videoId} (full)`);
  }
  await run(YTDLP, args);
  const files = [`${videoId}${tag}.mp4`, `${videoId}${tag}.mkv`, `${videoId}${tag}.webm`]
    .map((f) => path.join(CACHE, f))
    .filter((f) => existsSync(f));
  if (files.length === 0) throw new Error('Download fallito: nessun file generato');
  return files[0];
}

async function main() {
  let voiceoverDuration = 180;
  if (existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(readFileSync(META_JSON, 'utf8'));
      if (meta.voiceoverDuration && meta.voiceoverDuration > 10) {
        voiceoverDuration = meta.voiceoverDuration;
      }
    } catch {}
  }
  const targetDuration = Math.ceil(voiceoverDuration + 2);

  // Cache via URL file
  if (!FORCE && existsSync(BG_MP4) && existsSync(BG_URL_FILE)) {
    const cached = JSON.parse(readFileSync(BG_URL_FILE, 'utf8'));
    if (cached.topic === topic && cached.targetDuration >= targetDuration - 2) {
      const d = await probeDuration(BG_MP4);
      if (d >= targetDuration - 2) {
        console.log(`[download] cache hit: public/bg.mp4 (${d.toFixed(1)}s) per "${topic}"`);
        return;
      }
    }
  }

  // Durata minima = voiceover + 5s di margine. Il video deve coprire tutto SENZA loop.
  const minDuration = Math.ceil(voiceoverDuration + 5);

  let best = null;
  if (URL_OVERRIDE) {
    const m = URL_OVERRIDE.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
    const id = m ? m[1] : URL_OVERRIDE;
    console.log(`[download] URL override: ${id}`);
    const {out} = await run(YTDLP, [
      `https://www.youtube.com/watch?v=${id}`,
      '--no-download',
      '--print', '%(id)s\t%(channel)s\t%(duration)s\t%(width)s\t%(height)s\t%(title)s',
      '--no-warnings',
      '--js-runtimes', 'node',
    ]);
    const [vid, channel, duration, width, height, ...titleParts] = out.trim().split('\t');
    best = {
      id: vid,
      channel: channel || '',
      duration: parseFloat(duration),
      width: parseInt(width, 10) || 0,
      height: parseInt(height, 10) || 0,
      title: titleParts.join('\t'),
      url: `https://www.youtube.com/watch?v=${vid}`,
    };
  } else {
    const {location, query} = await resolveDroneLocation(topic);
    console.log(`[download] location: "${location}"`);
    const queryVariants = [
      query,
      `${location} drone aerial long 4k cinematic`,
      `${location} aerial cinematic 4k full`,
    ];
    for (const q of queryVariants) {
      const results = await ytSearch(q, minDuration, 25);
      if (results.length === 0) continue;
      const picked = pickBest(results, minDuration, SKIP_FIRST);
      if (picked) {
        best = picked;
        break;
      }
      console.warn(`[download] nessun candidato valido per "${q}", provo variante...`);
    }
    if (!best) {
      throw new Error(
        `Nessun video drone >= ${minDuration}s trovato per "${topic}". Prova con --url= oppure --skip=.`,
      );
    }
  }

  if (best.duration < minDuration) {
    throw new Error(
      `Video selezionato (${best.duration}s) più corto del target (${minDuration}s). Il loop è disabilitato.`,
    );
  }
  console.log(`[download] scelto: "${best.title}" — ${best.channel} — ${best.height}p — ${best.duration}s`);

  // Serve: 3s trim iniziale + targetDuration. Aggiungo 5s di margine.
  const neededSeconds = 3 + targetDuration + 5;
  const srcFile = await downloadVideo(best.id, neededSeconds);
  const srcDuration = await probeDuration(srcFile);

  // Trim primi 5s, center-crop 9:16, scala a 1080x1920, no audio
  // Se il source è più corto del target, loopa con stream_loop
  if (existsSync(BG_MP4)) unlinkSync(BG_MP4);

  const usableDuration = srcDuration - 3;
  if (usableDuration < targetDuration) {
    throw new Error(
      `Il video scaricato (${srcDuration.toFixed(1)}s) è più corto del target (${targetDuration}s) dopo il trim iniziale di 3s. Filtro ricerca mancato — interrompo.`,
    );
  }

  const args = [
    '-y',
    '-ss', '3',
    '-i', srcFile,
    '-t', String(targetDuration),
    '-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    BG_MP4,
  ];

  console.log(`[download] ffmpeg crop 9:16 → 1080x1920 (target ${targetDuration}s)`);
  await run(ffmpegPath, args);

  writeFileSync(
    BG_URL_FILE,
    JSON.stringify({topic, videoId: best.id, channel: best.channel, title: best.title, targetDuration}, null, 2),
  );
  const outDur = await probeDuration(BG_MP4);
  console.log(`[download] → public/bg.mp4 (${outDur.toFixed(1)}s, 1080x1920)`);
}

main().catch((e) => {
  console.error('[download]', e.message);
  process.exit(1);
});
