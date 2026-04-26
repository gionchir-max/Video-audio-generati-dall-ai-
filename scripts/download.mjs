import 'dotenv/config';
import {spawn} from 'node:child_process';
import {mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync, statSync} from 'node:fs';
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
const montageArg = process.argv.find((a) => a.startsWith('--montage='));
const MONTAGE_QUERY = montageArg ? montageArg.slice('--montage='.length).trim() : '';
const montageCountArg = process.argv.find((a) => a.startsWith('--montage-clips='));
const MONTAGE_CLIPS = montageCountArg ? parseInt(montageCountArg.slice('--montage-clips='.length), 10) : 0;

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
  // Fallback se il provider non supporta response_format json_object (es. Io Net per v4-pro):
  // OpenRouter risponde 404 "No endpoints available" → ripeti senza json mode, estrai JSON a mano.
  const systemContent =
    'Data una frase (può essere il nome di una città, un evento storico, un fenomeno culturale, un aneddoto), restituisci il luogo fisico più riprendibile con un drone che meglio lo rappresenta. Deve essere una località reale ripresa dall\'alto (città, monumento, skyline, paesaggio). Rispondi SOLO con JSON {"location": "nome luogo in inglese ottimizzato per ricerca YouTube", "query": "<location> drone aerial 4k cinematic skyline no watermark"}. Se l\'input è già una città usa quella. Esempi: "Parigi e la Sindrome di Parigi" → {"location": "Paris France", "query": "Paris France drone aerial 4k cinematic skyline no watermark"}. "la caduta dell\'impero romano" → {"location": "Rome Italy Colosseum", "query": "Rome Italy drone aerial 4k Colosseum skyline"}. "Roma" → {"location": "Rome Italy", "query": "Rome Italy drone aerial 4k cinematic skyline"}.';
  try {
    let useJsonMode = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      const reqBody = {
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        messages: [
          {role: 'system', content: systemContent},
          {role: 'user', content: topic},
        ],
      };
      if (useJsonMode) reqBody.response_format = {type: 'json_object'};
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tiktok-city.local',
          'X-Title': 'tiktok-city',
        },
        body: JSON.stringify(reqBody),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices[0].message.content;
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          const m = content.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
          else throw new Error('impossibile estrarre JSON');
        }
        if (parsed.location && parsed.query) return parsed;
        throw new Error('risposta senza location/query');
      }
      const errBody = await res.text();
      if (res.status === 404 && useJsonMode && /No endpoints available/i.test(errBody)) {
        useJsonMode = false;
        continue;
      }
      throw new Error(`${res.status}: ${errBody.slice(0, 120)}`);
    }
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

// ─── Montage mode ──────────────────────────────────────────────────────────
// Scarica N clip diversi che matchano la query, ne prende un segmento casuale
// da ciascuno, normalizza tutti a 1080x1920@30fps h264 yuv420p e li concatena.
// Usato per sfondi "a spezzoni" (persona che parla, evento, compilation tematica)
// quando un singolo video continuo non si trova o non va bene.

function pickMontageClips(results, N, minClipSourceDuration, query = '') {
  // Canali/keyword tipicamente pieni di grafiche, sovrimpressioni, ticker: dannosi se vogliamo
  // footage "pulito senza scritte".
  const TEXTY_CHANNELS = ['tg1', 'tg2', 'tg3', 'tg5', 'tgcom', 'rainews', 'sky tg', 'la7', 'mediaset', 'cnn', 'bbc news', 'fox news', 'nbc news', 'cbs news', 'reuters', 'euronews'];
  const TEXTY_TITLE_KW = ['tg ', 'tg1', 'tg2', 'tg3', 'tg5', 'telegiornale', 'notiziario', 'servizio', 'speciale tg', 'news report', 'breaking news', 'edizione straordinaria'];
  const CLEAN_TITLE_KW = ['drone', 'aerial', '4k', 'cinematic', 'archive', 'archival', 'footage', 'b-roll', 'broll', 'timelapse', 'no commentary', 'raw footage'];

  // Estrai keyword "topic" dalla query escludendo termini tecnici/generici: servono a
  // verificare che il titolo parli davvero dell'argomento richiesto (es "pantelleria")
  // e non di un footage drone qualsiasi tirato dentro dai risultati di ricerca.
  const GENERIC_KW = new Set([
    'drone', 'drones', 'aerial', '4k', '8k', 'hd', 'uhd', 'cinematic', 'footage', 'b-roll',
    'broll', 'archive', 'archival', 'video', 'aereo', 'aerea', 'riprese', 'timelapse', 'raw',
    'island', 'isola', 'nuclear', 'reactor', 'cooling', 'tower', 'the', 'del', 'della', 'the',
    'and', 'con', 'per', 'from', 'interview', 'intervista',
  ]);
  const topicWords = query
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 4 && !GENERIC_KW.has(w));

  const scored = results
    .filter((r) => r.height >= 720 && r.duration >= minClipSourceDuration)
    .map((r) => {
      let score = 0;
      const t = (r.title || '').toLowerCase();
      const c = (r.channel || '').toLowerCase();
      if (r.height >= 2160) score += 15;
      else if (r.height >= 1080) score += 10;
      else score += 3;
      if (r.duration >= 120 && r.duration <= 1500) score += 8;
      if (r.duration > 3600) score -= 25; // live/stream lunghi
      if (r.duration < 90) score -= 10;
      if (t.includes('#shorts') || t.includes('short')) score -= 25;
      if (t.includes('reaction') || t.includes('reazione')) score -= 8;
      if (t.includes('watermark') || t.includes('logo')) score -= 5;
      // Anti-scritte: penalizza canali news e titoli da telegiornale/servizio
      if (TEXTY_CHANNELS.some((k) => c.includes(k))) score -= 30;
      if (TEXTY_TITLE_KW.some((k) => t.includes(k))) score -= 20;
      // Pro-clean: premia footage drone/aerial/archivio/b-roll (di solito senza scritte)
      if (CLEAN_TITLE_KW.some((k) => t.includes(k))) score += 15;
      // Match topic: se la query contiene nomi propri/argomenti specifici, il titolo
      // DEVE contenerli, altrimenti è footage random agganciato alla ricerca.
      if (topicWords.length > 0) {
        const tc = t + ' ' + c;
        const matched = topicWords.filter((w) => tc.includes(w)).length;
        if (matched >= 1) score += 50;
        else score -= 60;
      }
      return {...r, score};
    })
    .sort((a, b) => b.score - a.score);
  // max 2 clip per canale, per variare fonti
  const perChannel = new Map();
  const picks = [];
  for (const s of scored) {
    const c = s.channel || '(unknown)';
    if ((perChannel.get(c) ?? 0) >= 2) continue;
    perChannel.set(c, (perChannel.get(c) ?? 0) + 1);
    picks.push(s);
    if (picks.length >= N) break;
  }
  return picks;
}

async function downloadAndNormalizeSegment(videoId, startSec, clipLen, idx, total) {
  const MONTAGE_DIR = path.join(CACHE, 'montage');
  mkdirSync(MONTAGE_DIR, {recursive: true});
  const baseTag = `${videoId}_${Math.floor(startSec)}_${Math.ceil(clipLen)}`;
  const rawFile = path.join(MONTAGE_DIR, `${baseTag}_raw.mp4`);
  const normFile = path.join(MONTAGE_DIR, `${baseTag}_norm.mp4`);

  if (existsSync(normFile)) {
    // Se il file in cache è troppo piccolo per la sua durata, è quasi certamente
    // un fade-to-black: lo rigenero da capo (elimino l'entry vecchia).
    const bytesPerSec = statSync(normFile).size / Math.max(1, clipLen);
    if (bytesPerSec < 15000) {
      console.log(`[montage] (${idx + 1}/${total}) cache ${baseTag} scartato (${(bytesPerSec / 1024).toFixed(1)} KB/s → black)`);
      try { unlinkSync(normFile); } catch {}
      try { unlinkSync(rawFile); } catch {}
    } else {
      console.log(`[montage] (${idx + 1}/${total}) cache hit ${baseTag}`);
      return normFile;
    }
  }
  if (!existsSync(rawFile)) {
    const end = Math.ceil(startSec + clipLen + 1);
    console.log(`[montage] (${idx + 1}/${total}) yt-dlp ${videoId} [${Math.floor(startSec)}–${end}s]`);
    await run(YTDLP, [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-f', 'bestvideo[height>=720][ext=mp4]+bestaudio/bestvideo[ext=mp4][height>=720]/best[height>=720]/best',
      '--merge-output-format', 'mp4',
      '--download-sections', `*${Math.floor(startSec)}-${end}`,
      '--ffmpeg-location', ffmpegPath,
      '-o', rawFile,
      '--no-warnings', '--quiet',
      '--js-runtimes', 'node',
    ]);
    if (!existsSync(rawFile)) throw new Error(`yt-dlp non ha prodotto ${rawFile}`);
  }
  console.log(`[montage] (${idx + 1}/${total}) normalizing → 1080x1920@30fps (cinematic grade)`);
  await run(ffmpegPath, [
    '-y',
    '-ss', '0.5', // piccolo skip per saltare frame di apertura instabili del section cut
    '-i', rawFile,
    '-t', String(clipLen),
    // Grading cinematografico: crop 9:16 + scale 1080x1920 + contrast/saturation lift leggero
    // + subtle vignette (scurisce gli angoli per focalizzare il centro dove stanno banner/sottotitoli)
    '-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,eq=contrast=1.08:saturation=1.15:gamma=0.97,vignette=angle=PI/5.5,fps=30,setsar=1',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-movflags', '+faststart',
    normFile,
  ]);
  // Sanity: byte/sec troppo basso → quasi certamente frame statici o tutto nero.
  // Succede ad esempio quando l'offset pescato cade nell'outro fade-to-black del video.
  const bytesPerSec = statSync(normFile).size / Math.max(1, clipLen);
  if (bytesPerSec < 15000) {
    throw new Error(`clip "black" rilevato (${(bytesPerSec / 1024).toFixed(1)} KB/s, soglia 15 KB/s)`);
  }
  return normFile;
}

async function concatMontageClips(clipFiles, targetDuration) {
  const MONTAGE_DIR = path.join(CACHE, 'montage');
  const listFile = path.join(MONTAGE_DIR, `concat_${Date.now()}.txt`);
  const listContent = clipFiles
    .map((f) => `file '${f.replace(/'/g, "'\\''")}'`)
    .join('\n');
  writeFileSync(listFile, listContent);

  if (existsSync(BG_MP4)) unlinkSync(BG_MP4);

  // Concat con re-encode leggero per garantire continuità (i clip sono già normalizzati,
  // ma -c copy può incastrarsi con cambi di GOP; encode veloce è più robusto).
  console.log(`[montage] concat ${clipFiles.length} clip → ${targetDuration}s`);
  await run(ffmpegPath, [
    '-y',
    '-f', 'concat', '-safe', '0',
    '-i', listFile,
    '-t', String(targetDuration),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-an',
    '-movflags', '+faststart',
    BG_MP4,
  ]);
  try {
    unlinkSync(listFile);
  } catch {}
}

async function downloadMontage(query, targetDuration) {
  // N clip (4–8) in base alla durata target, ~20s per clip di default
  const N = MONTAGE_CLIPS > 0
    ? Math.max(2, Math.min(12, MONTAGE_CLIPS))
    : Math.max(4, Math.min(8, Math.ceil(targetDuration / 22)));
  const clipLen = Math.max(10, Math.ceil(targetDuration / N) + 1);
  // Ogni video sorgente deve essere almeno abbastanza lungo per poterne estrarre
  // un segmento + skip iniziale/finale sicuro
  const minSourceDur = clipLen + 45;
  console.log(`[montage] query="${query}" · N=${N} clip · ${clipLen}s ciascuno · target ${targetDuration}s`);

  // Raccogli candidati da più varianti di ricerca per avere diversità di canale
  const seen = new Set();
  const allResults = [];
  const variants = [query, `${query} lungo`, `${query} discorso`, `${query} intervista`];
  for (const q of variants) {
    try {
      const r = await ytSearch(q, minSourceDur, 25);
      for (const v of r) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          allResults.push(v);
        }
      }
    } catch (e) {
      console.warn(`[montage] ricerca "${q}" fallita: ${e.message}`);
    }
    if (allResults.length >= N * 4) break;
  }
  if (allResults.length === 0) {
    throw new Error(`Nessun risultato per "${query}". Prova una query più generica.`);
  }

  const picks = pickMontageClips(allResults, N, minSourceDur, query);
  if (picks.length < 2) {
    throw new Error(`Solo ${picks.length} candidati validi per "${query}" (serve almeno 2).`);
  }
  if (picks.length < N) {
    console.warn(`[montage] trovati ${picks.length}/${N} candidati, procedo comunque`);
  }
  for (const p of picks) {
    console.log(`  · ${p.id} · ${p.height}p · ${Math.floor(p.duration)}s · ${p.channel} — ${p.title}`);
  }

  const clipFiles = [];
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    // offset casuale evitando primi 20s (intro/bumper) e ultimi 30s (outro/fade-to-black)
    const safeMin = 20;
    const safeMax = Math.max(safeMin + 5, Math.floor(p.duration - clipLen - 30));
    const triedOffsets = new Set();
    const MAX_ATTEMPTS = 3;
    let f = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let start;
      let tries = 0;
      do {
        start = safeMin + Math.floor(Math.random() * Math.max(1, safeMax - safeMin));
        tries++;
      } while (triedOffsets.has(start) && tries < 10);
      triedOffsets.add(start);
      try {
        f = await downloadAndNormalizeSegment(p.id, start, clipLen, i, picks.length);
        break;
      } catch (e) {
        console.warn(`[montage] clip ${i + 1} tentativo ${attempt + 1}/${MAX_ATTEMPTS} fallito (${p.id} @ ${start}s): ${e.message}`);
      }
    }
    if (f) {
      clipFiles.push(f);
    } else {
      console.warn(`[montage] clip ${i + 1} (${p.id}): skip dopo ${MAX_ATTEMPTS} tentativi`);
    }
  }
  if (clipFiles.length < 2) {
    throw new Error(`Solo ${clipFiles.length} clip scaricati con successo: abortisco.`);
  }

  // Shuffle per alternanza fonti
  for (let i = clipFiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clipFiles[i], clipFiles[j]] = [clipFiles[j], clipFiles[i]];
  }

  await concatMontageClips(clipFiles, targetDuration);

  writeFileSync(
    BG_URL_FILE,
    JSON.stringify({
      topic,
      mode: 'montage',
      montageQuery: query,
      clips: clipFiles.map((f) => path.basename(f)),
      sources: picks.map((p) => ({id: p.id, channel: p.channel, title: p.title})),
      targetDuration,
    }, null, 2),
  );
  const outDur = await probeDuration(BG_MP4);
  console.log(`[montage] → public/bg.mp4 (${outDur.toFixed(1)}s, 1080x1920, ${clipFiles.length} clip)`);
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

  // Cache via URL file (funziona sia per drone che per montage)
  if (!FORCE && existsSync(BG_MP4) && existsSync(BG_URL_FILE)) {
    const cached = JSON.parse(readFileSync(BG_URL_FILE, 'utf8'));
    const modeMatch = MONTAGE_QUERY
      ? (cached.mode === 'montage' && cached.montageQuery === MONTAGE_QUERY)
      : (cached.mode !== 'montage');
    if (cached.topic === topic && modeMatch && cached.targetDuration >= targetDuration - 2) {
      const d = await probeDuration(BG_MP4);
      if (d >= targetDuration - 2) {
        console.log(`[download] cache hit: public/bg.mp4 (${d.toFixed(1)}s) per "${topic}"${MONTAGE_QUERY ? ' [montage]' : ''}`);
        return;
      }
    }
  }

  if (MONTAGE_QUERY) {
    await downloadMontage(MONTAGE_QUERY, targetDuration);
    return;
  }

  // Durata minima = voiceover + 15s di margine (10s trim iniziale + 5s buffer). Il video deve coprire tutto SENZA loop.
  const minDuration = Math.ceil(voiceoverDuration + 15);

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

  // Serve: 10s trim iniziale + targetDuration. Aggiungo 5s di margine.
  const neededSeconds = 10 + targetDuration + 5;
  const srcFile = await downloadVideo(best.id, neededSeconds);
  const srcDuration = await probeDuration(srcFile);

  // Trim primi 5s, center-crop 9:16, scala a 1080x1920, no audio
  // Se il source è più corto del target, loopa con stream_loop
  if (existsSync(BG_MP4)) unlinkSync(BG_MP4);

  const usableDuration = srcDuration - 10;
  if (usableDuration < targetDuration) {
    throw new Error(
      `Il video scaricato (${srcDuration.toFixed(1)}s) è più corto del target (${targetDuration}s) dopo il trim iniziale di 10s. Filtro ricerca mancato — interrompo.`,
    );
  }

  const args = [
    '-y',
    '-ss', '10',
    '-i', srcFile,
    '-t', String(targetDuration),
    // Grading cinematografico: crop 9:16 + scale 1080x1920 + contrast/saturation lift leggero
    // + subtle vignette (scurisce gli angoli per focalizzare il centro dove stanno banner/sottotitoli)
    '-vf', 'crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,eq=contrast=1.08:saturation=1.15:gamma=0.97,vignette=angle=PI/5.5',
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
    JSON.stringify({topic, mode: 'drone', videoId: best.id, channel: best.channel, title: best.title, targetDuration}, null, 2),
  );
  const outDur = await probeDuration(BG_MP4);
  console.log(`[download] → public/bg.mp4 (${outDur.toFixed(1)}s, 1080x1920)`);
}

main().catch((e) => {
  console.error('[download]', e.message);
  process.exit(1);
});
