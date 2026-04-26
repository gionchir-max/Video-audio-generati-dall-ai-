import 'dotenv/config';
import {spawn} from 'node:child_process';
import {mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync} from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {path as ffprobePath} from '@ffprobe-installer/ffprobe';

const ROOT = path.resolve('.');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'out');
mkdirSync(PUBLIC, {recursive: true});
mkdirSync(OUT, {recursive: true});

const MUSIC_OUT = path.join(PUBLIC, 'music.mp3');
const MUSIC_CHOICE = path.join(OUT, 'music.choice.json');
const META_JSON = path.join(ROOT, 'src', 'meta.json');

// Loudness target: -14 LUFS (stesso livello della traccia corrente, preserva il mix nel video).
const TARGET_LUFS = -14;

// Catalogo di tracce disponibili. La prima voce è il fallback di default (waltz neutro).
// Ogni traccia è descritta per il mood/tono, cosi' l'AI puo' scegliere quella piu' adatta
// al topic. Se manca un file o l'AI fallisce, si usa la prima disponibile.
const CATALOG = [
  {
    id: 'waltz',
    file: '/Volumes/Extreme SSD/Cataio/luis-sal-edit/public/audio/bg_waltz.mp3',
    mood: 'valzer classico, elegante, neutro. Adatto a topic storici, narrativi, culturali, racconti eleganti e discorsivi.',
  },
  {
    id: 'cinematic_epic',
    file: '/Volumes/Extreme SSD/Video Claude/Cinematic Epic Music by Infraction [No Copyright Music] Action(mp3j.cc).mp3',
    mood: 'epico cinematografico, drammatico, percussivo. Adatto a topic forti, divisivi, indignazione, tensione politica, crisi, denuncia, contrapposizioni.',
  },
  {
    id: 'dark_moment',
    file: '/Volumes/Extreme SSD/Video gionchir/Audio/Dark Moment [YLahteWS1bY].mp3',
    mood: 'cupo, misterioso, sospeso. Adatto a topic oscuri, tragedie, citta fantasma, incidenti nucleari, vicende irrisolte, tensione costante.',
  },
  {
    id: 'whodunit',
    file: '/Volumes/Extreme SSD/Video gionchir/Audio/Whodunit [VxeRyFuTeW0].mp3',
    mood: 'mystery investigativo, passi felpati, curiosita crescente. Adatto a topic che raccontano un enigma, un segreto da svelare, un indagine, scoperte storiche.',
  },
  {
    id: 'unsettling',
    file: '/Volumes/Extreme SSD/Video gionchir/Audio/musica inquietante.mp3',
    mood: 'inquietante, ansiogeno, drone atmosferico. Adatto a topic profondamente disturbanti, morte, orrore, crimini, disastri ambientali.',
  },
  {
    id: 'latin_trap',
    file: '/Volumes/Extreme SSD/Cataio/Pubblicati/Short 1/Sport Latin Trap Energy by Infraction [No Copyright Music]  Pachuca.mp3',
    mood: 'energetico, trap latino, ritmo pulsante. Adatto a topic sportivi, contemporanei, urban, giovanili, competitivi, lifestyle energico.',
  },
];

const FORCE = process.argv.includes('--force');
const topic = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ').trim();

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) =>
      code === 0 ? resolve({out, err}) : reject(new Error(`${cmd} exit ${code}: ${err}`)),
    );
  });
}

async function probeDuration(file) {
  const {out} = await run(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    file,
  ]);
  return parseFloat(out.trim());
}

async function pickTrackViaAI(availableTracks) {
  const API_KEY = process.env.OPENROUTER_API_KEY;
  const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3.2';
  if (!API_KEY || availableTracks.length === 1) return availableTracks[0];

  const catalogText = availableTracks
    .map((t) => `- id="${t.id}" · ${t.mood}`)
    .join('\n');

  const systemPrompt =
    'Sei un music supervisor per video TikTok virali. Dato un topic e una lista di tracce musicali con relativo mood, scegli la traccia PIU ADATTA al topic. La musica deve amplificare l emozione dominante del topic e sostenere il ritmo narrativo per 3 minuti senza stancare. Rispondi SOLO con un JSON {"id": "<id_scelto>", "reason": "<una frase sul perche>"}. Nessun testo fuori dal JSON.';
  const userPrompt = `Topic: "${topic}"\n\nTracce disponibili:\n${catalogText}\n\nScegli l id che meglio accompagna un voice-over in italiano di ~3 minuti su questo topic (tono divisivo, narrativo stile Barbero, hook continui, payoff finale). La musica va a -14 LUFS come sottofondo, quindi privilegia tracce con profilo ritmico chiaro ma non invadente.`;

  // Fallback se il provider non supporta response_format json_object (es. Io Net per v4-pro):
  // OpenRouter risponde 404 "No endpoints available" → ripeti senza json mode, estrai JSON a mano.
  try {
    let useJsonMode = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      const reqBody = {
        model: MODEL,
        temperature: 0.3,
        messages: [
          {role: 'system', content: systemPrompt},
          {role: 'user', content: userPrompt},
        ],
      };
      if (useJsonMode) reqBody.response_format = {type: 'json_object'};
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tiktok-city.local',
          'X-Title': 'tiktok-city',
        },
        body: JSON.stringify(reqBody),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('risposta vuota');
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          const m = content.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
          else throw new Error('impossibile estrarre JSON');
        }
        const chosen = availableTracks.find((t) => t.id === parsed.id);
        if (!chosen) throw new Error(`id "${parsed.id}" non trovato nel catalogo disponibile`);
        console.log(`[music] AI (${MODEL}) → "${chosen.id}": ${parsed.reason || '(no reason)'}`);
        return chosen;
      }
      const errBody = await res.text();
      if (res.status === 404 && useJsonMode && /No endpoints available/i.test(errBody)) {
        useJsonMode = false;
        continue;
      }
      throw new Error(`${res.status}: ${errBody.slice(0, 120)}`);
    }
    throw new Error('fallito dopo retry');
  } catch (e) {
    console.warn(`[music] AI pick fallita (${e.message}), uso fallback "${availableTracks[0].id}"`);
    return availableTracks[0];
  }
}

async function main() {
  // Filtra catalogo: solo tracce effettivamente presenti sul disco
  const available = CATALOG.filter((t) => existsSync(t.file));
  if (available.length === 0) {
    throw new Error('Nessuna traccia del catalogo disponibile. Verifica i percorsi in CATALOG.');
  }

  // Durata target: voiceoverDuration + 2s di coda (come il video)
  let targetDuration = 180;
  if (existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(readFileSync(META_JSON, 'utf8'));
      if (meta.voiceoverDuration && meta.voiceoverDuration > 0) {
        targetDuration = Math.ceil(meta.voiceoverDuration + 2);
      }
    } catch {}
  }

  // Cache: se lo stesso topic ha gia' prodotto una scelta e il file esiste, riusa (senza --force)
  let chosen = null;
  if (!FORCE && existsSync(MUSIC_CHOICE) && existsSync(MUSIC_OUT)) {
    try {
      const cached = JSON.parse(readFileSync(MUSIC_CHOICE, 'utf8'));
      if (cached.topic === topic && cached.id) {
        const hit = available.find((t) => t.id === cached.id);
        const currentDur = await probeDuration(MUSIC_OUT);
        if (hit && currentDur >= targetDuration - 2) {
          console.log(`[music] cache hit: "${hit.id}" per topic "${topic}" (${currentDur.toFixed(1)}s)`);
          return;
        }
      }
    } catch {}
  }

  if (!chosen) {
    chosen = topic ? await pickTrackViaAI(available) : available[0];
  }

  const srcDuration = await probeDuration(chosen.file);
  console.log(
    `[music] traccia: "${chosen.id}" · ${srcDuration.toFixed(1)}s · target ${targetDuration}s${
      srcDuration < targetDuration ? ' (loop necessario)' : ''
    }`,
  );

  if (existsSync(MUSIC_OUT)) unlinkSync(MUSIC_OUT);

  // Se la traccia e piu corta del target, stream_loop -1 la ripete all'infinito;
  // il flag -t limita l'output alla durata richiesta. Loudnorm a -14 LUFS preserva il livello
  // atteso dal mix nel MainVideo (Audio volume=0.15) indipendentemente dalla traccia scelta.
  const needLoop = srcDuration < targetDuration;
  const args = ['-y'];
  if (needLoop) args.push('-stream_loop', '-1');
  args.push(
    '-i', chosen.file,
    '-t', String(targetDuration),
    '-af', `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11`,
    '-ar', '48000',
    '-ac', '2',
    '-b:a', '192k',
    MUSIC_OUT,
  );

  console.log(`[music] normalizzo a ${TARGET_LUFS} LUFS e scrivo ${targetDuration}s...`);
  await run(ffmpegPath, args);

  const outDur = await probeDuration(MUSIC_OUT);
  writeFileSync(
    MUSIC_CHOICE,
    JSON.stringify({topic, id: chosen.id, file: chosen.file, targetDuration, lufs: TARGET_LUFS}, null, 2),
  );
  console.log(`[music] → public/music.mp3 (${outDur.toFixed(1)}s @ ${TARGET_LUFS} LUFS) · "${chosen.id}"`);
}

main().catch((e) => {
  console.error('[music]', e.message);
  process.exit(1);
});
