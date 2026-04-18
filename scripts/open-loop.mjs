import 'dotenv/config';
import {readFileSync, writeFileSync, existsSync, statSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const SRC = path.join(ROOT, 'src');
const SCRIPT_TXT = path.join(SRC, 'script.txt');
const WORDS_JSON = path.join(SRC, 'words.json');
const OPEN_LOOP_JSON = path.join(SRC, 'open-loop.json');

const FORCE = process.argv.includes('--force');

if (!existsSync(SCRIPT_TXT) || !existsSync(WORDS_JSON)) {
  console.error('[open-loop] mancano src/script.txt o src/words.json — esegui prima align');
  process.exit(1);
}

const scriptText = readFileSync(SCRIPT_TXT, 'utf8').trim();
const words = JSON.parse(readFileSync(WORDS_JSON, 'utf8'));

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3.2';

function writeEmpty(reason) {
  writeFileSync(
    OPEN_LOOP_JSON,
    JSON.stringify({question: '', answerAnchor: '', start: 0, end: 0, reason}, null, 2),
  );
  console.log(`[open-loop] overlay disabilitato: ${reason}`);
}

// Cache hit: il JSON esiste, ha timings validi, ed è stato scritto DOPO script.txt e words.json
// (altrimenti lo script/timings sono cambiati e la cache è obsoleta).
if (!FORCE && existsSync(OPEN_LOOP_JSON)) {
  try {
    const c = JSON.parse(readFileSync(OPEN_LOOP_JSON, 'utf8'));
    const scriptMtime = statSync(SCRIPT_TXT).mtimeMs;
    const wordsMtime = statSync(WORDS_JSON).mtimeMs;
    const jsonMtime = statSync(OPEN_LOOP_JSON).mtimeMs;
    const fresh = jsonMtime > scriptMtime && jsonMtime > wordsMtime;
    if (
      fresh &&
      c.question &&
      typeof c.start === 'number' &&
      typeof c.end === 'number' &&
      c.end > c.start
    ) {
      console.log('[open-loop] cache hit (usa --force per rigenerare)');
      process.exit(0);
    }
  } catch {}
}

if (!API_KEY) {
  writeEmpty('OPENROUTER_API_KEY mancante');
  process.exit(0);
}

const SYSTEM = `Analizzi uno script voice-over TikTok in italiano con struttura "open loop": nei primi ~15 secondi viene posta una domanda a cui si risponde solo negli ultimi ~15% del video.

Estrai:
1. "question": la domanda posta all'inizio. Rendila compatta e leggibile per un overlay su schermo (max 12 parole, una sola frase interrogativa, finisce con "?"). Puoi ricondensare il fraseggio mantenendo il senso, ma DEVE restare fedele alla domanda dello script.
2. "answerAnchor": le prime 4-6 parole ESATTE, LETTERALI, del punto dello script dove inizia la risposta (il payoff finale). Lowercase, senza punteggiatura. Deve essere una sequenza contigua presente nello script.

Se lo script NON ha una struttura chiara domanda/risposta, restituisci entrambi i campi vuoti: {"question": "", "answerAnchor": ""}.

Rispondi SOLO con JSON valido.`;

async function callLLM() {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tiktok-city.local',
      'X-Title': 'tiktok-city',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: {type: 'json_object'},
      messages: [
        {role: 'system', content: SYSTEM},
        {role: 'user', content: scriptText},
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

// Trova il primo indice in `words` dove la sequenza di `needle` match (anche parziale:
// accetta una finestra di tokens in sequenza, tollerando 1 token mancante).
function findPhraseStart(phrase, wordsArr, minIdx = 0, maxIdx = Infinity) {
  const needle = tokens(phrase).slice(0, 6);
  if (needle.length < 2) return null;
  const lastIdx = Math.min(wordsArr.length - needle.length, maxIdx);
  for (let i = minIdx; i <= lastIdx; i++) {
    let matched = 0;
    let gap = 0;
    let j = 0;
    for (let k = 0; k < needle.length && i + k + gap < wordsArr.length; k++) {
      const wt = normalize(wordsArr[i + k + gap].word);
      if (wt === needle[j]) {
        matched++;
        j++;
      } else if (gap === 0 && j > 0) {
        gap = 1;
        k--; // riprova stessa posizione needle con gap
      } else {
        break;
      }
    }
    if (matched >= Math.min(3, needle.length)) return i;
  }
  return null;
}

async function main() {
  console.log('[open-loop] estraggo domanda + ancora risposta via LLM...');
  let parsed;
  try {
    parsed = await callLLM();
  } catch (e) {
    writeEmpty(`LLM failed: ${e.message}`);
    return;
  }

  const question = (parsed.question || '').trim();
  const answerAnchor = (parsed.answerAnchor || '').trim();

  if (!question || !answerAnchor) {
    writeEmpty('LLM non ha trovato struttura domanda/risposta');
    return;
  }

  console.log(`[open-loop] question: "${question}"`);
  console.log(`[open-loop] answerAnchor: "${answerAnchor}"`);

  const qIdx = findPhraseStart(question, words, 0, Math.floor(words.length * 0.4));
  const aIdx = findPhraseStart(
    answerAnchor,
    words,
    qIdx != null ? qIdx + 3 : Math.floor(words.length * 0.5),
  );

  if (qIdx == null) {
    writeEmpty(`question non trovata in words.json`);
    return;
  }
  if (aIdx == null) {
    writeEmpty(`answerAnchor non trovato in words.json`);
    return;
  }

  const start = words[qIdx].start;
  const end = words[aIdx].start;
  if (end <= start + 5) {
    writeEmpty(`range troppo corto (${(end - start).toFixed(1)}s)`);
    return;
  }

  writeFileSync(
    OPEN_LOOP_JSON,
    JSON.stringify({question, answerAnchor, start, end}, null, 2),
  );
  console.log(
    `[open-loop] → src/open-loop.json (${start.toFixed(2)}s → ${end.toFixed(2)}s · ${(end - start).toFixed(1)}s in overlay)`,
  );
}

main().catch((e) => {
  console.error('[open-loop]', e.message);
  writeEmpty(`error: ${e.message}`);
  process.exit(0); // non blocchiamo la pipeline: overlay opzionale
});
