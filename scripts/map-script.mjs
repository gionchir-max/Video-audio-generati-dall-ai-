import 'dotenv/config';
import {writeFileSync, mkdirSync, readFileSync, existsSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'out');
const SRC = path.join(ROOT, 'src');
mkdirSync(OUT, {recursive: true});
mkdirSync(SRC, {recursive: true});

const SCRIPT_TXT = path.join(SRC, 'script.txt');
const BANNER_JSON = path.join(SRC, 'banner.json');
const SCRIPT_META = path.join(OUT, 'script.meta.json');
const FACTS_JSON = path.join(SRC, 'facts.json');

const topic = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ').trim();
if (!topic) {
  console.error('Usage: node scripts/map-script.mjs "<topic>"');
  process.exit(1);
}

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3.2';
if (!API_KEY) {
  console.error('OPENROUTER_API_KEY mancante nel .env');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');
if (!FORCE && existsSync(SCRIPT_TXT) && existsSync(BANNER_JSON) && existsSync(SCRIPT_META)) {
  const meta = JSON.parse(readFileSync(SCRIPT_META, 'utf8'));
  if (meta.topic === topic && meta.map === true) {
    console.log(`[map-script] cache hit per "${topic}" — skip (use --force per rigenerare)`);
    process.exit(0);
  }
}

if (!existsSync(FACTS_JSON)) {
  console.error(`[map-script] manca ${FACTS_JSON} — deve contenere i fatti geografici per "${topic}"`);
  process.exit(1);
}

const facts = JSON.parse(readFileSync(FACTS_JSON, 'utf8'));

const SYSTEM = `Sei uno sceneggiatore italiano specializzato in contenuti virali TikTok in stile Alessandro Barbero sporcato da bar. Scrivi voice-over di ~3 minuti (450-500 parole, 150 wpm) per un video TikTok con mappe animate di sottofondo. Ogni frase dello script verrà sincronizzata a un'animazione geografica (pan/zoom su una città, linea che disegna un gasdotto, pin che compare, area evidenziata). Lo script DEVE essere scritto per massimizzare la resa visiva sulla mappa.

PRINCIPI PSICOLOGICI (non nominarli, usali):
- ZEIGARNIK EFFECT: apri un loop nei primi 10 secondi, chiudilo solo a fine video.
- INFORMATION GAP: crea un divario di conoscenza preciso che brucia.
- NARRATIVE TRANSPORTATION: dettagli concreti, luoghi precisi, numeri.
- COMMITMENT ESCALATION: alza la posta ogni 25-30s.
- PEAK-END RULE: climax potente + chiusura memorabile.

REGOLE GEO-SPECIFICHE (FONDAMENTALI):

A. OGNI AFFERMAZIONE HA UN LUOGO FISICO. Quando citi un fatto, DEVI citare il luogo geografico reale dove accade: città, stretto, terminale, gasdotto, zona specifica. NON dire "in Europa" se puoi dire "Rotterdam" o "a Piombino". NON dire "in Medio Oriente" se puoi dire "Stretto di Hormuz" o "Ras Laffan". NON dire "in Russia" se puoi dire "terminale di Sabetta, penisola di Yamal".

B. SCANDISCI I LUOGHI NEL TESTO. Almeno 8-12 toponimi distinti nel voice-over. Ogni toponimo è una scena mappa. Esempi di transizione buona: "parti da Hormuz... sali su a Ras Laffan in Qatar... spostati a nord a Yamal... scendi a Rotterdam... arrivi al terminale di Piombino". Lo spettatore deve viaggiare con gli occhi.

C. ROTTE, FLUSSI, GASDOTTI. Quando parli di movimento di gas/navi/merci, nominalo come rotta tra due punti fisici. "Dal golfo persico risalgono lungo il Mar Rosso fino a Yanbu". "Le metaniere russe partono da Sabetta e attraversano l'artico fino a Zeebrugge". Ogni rotta è una linea che si disegna sulla mappa.

D. NUMERI E DATE PRECISE. Ogni percentuale, ogni cifra, ogni data del dossier fatti va usata. Mai approssimare.

REGOLE TONO (barberismo sporcato):

1. PRIMI 2 SECONDI = TOPIC + DOMANDA. Frase 1: dichiara il topic ancorato a un luogo. Frase 2-3: LA DOMANDA che brucia, specifica, alla quale rispondi solo a fine video.

2. TONO DIRETTO, PAROLACCE SELEZIONATE. Frasi corte, verbi forti. "Cazzo", "stronzata", "coglioni" usati con ritmo, 3-5 volte totali, mai ogni frase. Parla come amico incazzato al bar. Mai accademico.

3. HOOK OGNI 25-35s + RICHIAMO DEL LOOP. "Aspetta che c'è di peggio", "la risposta te la do tra poco", "e adesso tieniti forte".

4. DIVISIVO. Prendi posizione. Fai incazzare una metà, conquista l'altra. Zero neutralità.

5. PAYOFF FINALE (ultimo 15%). Rispondi alla domanda con il fatto più sorprendente del dossier (la "verità nascosta"). Deve dare la sensazione di aver guadagnato qualcosa.

6. CHIUSURA CON CTA diretto ai commenti. Ultime 2 frasi azione: "scrivilo nei commenti", "tagga quello che difende la UE", "salva prima che TikTok me lo tolga".

7. FORMATO: nessun emoji, nessun markdown, una singola stringa continua con punteggiatura normale.

BANNER HOOK: max 6 parole, MAIUSCOLO, contiene il soggetto del video. Deve funzionare senza audio. Es: "GAS E GUERRA LA VERITA", "EUROPA IN GINOCCHIO SUL GAS", "HORMUZ CHIUSO E NOI PAGHIAMO".

Restituisci ESCLUSIVAMENTE JSON valido:
{
  "banner": "FRASE MAIUSCOLO MAX 6 PAROLE",
  "script": "testo voice-over 450-500 parole, tanti toponimi"
}
Nessun testo fuori dal JSON.`;

const factsText = JSON.stringify(facts, null, 2);

const USER = `Argomento: ${topic}

DOSSIER FATTI (obbligatorio usare numeri, date e toponimi esatti da qui):
${factsText}

Scrivi il voice-over rispettando TUTTE le regole.
- Frase 1: dichiara il topic ancorando a luogo fisico.
- Frase 2-3: LA DOMANDA bruciante (open loop).
- Corpo: viaggio geografico con almeno 8-12 toponimi concreti dal dossier. Rotte di gas come linee tra due punti.
- Richiama il loop 1-2 volte.
- Payoff finale: la verità nascosta dal dossier — Europa ha importato record LNG russo (Yamal, Sabetta) proprio mentre impone il ban dal 2027. Spiega la contraddizione con numeri precisi.
- CTA finale ai commenti.
Tono: al limite dell'offesa ma legale. Divisivo.`;

async function callOpenRouter() {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tiktok-city.local',
      'X-Title': 'tiktok-city',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.85,
      response_format: {type: 'json_object'},
      messages: [
        {role: 'system', content: SYSTEM},
        {role: 'user', content: USER},
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Nessun contenuto restituito');
  return content;
}

function extractJson(content) {
  try { return JSON.parse(content); } catch {}
  const match = content.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Impossibile estrarre JSON');
}

console.log(`[map-script] genero voice-over geo per "${topic}" con ${MODEL}...`);
const raw = await callOpenRouter();
const parsed = extractJson(raw);

if (!parsed.script || !parsed.banner) {
  console.error('Risposta malformata:', parsed);
  process.exit(1);
}

const scriptText = parsed.script
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .trim();

const bannerText = parsed.banner
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .trim()
  .toUpperCase();

writeFileSync(SCRIPT_TXT, scriptText + '\n');
writeFileSync(BANNER_JSON, JSON.stringify({text: bannerText}, null, 2));
writeFileSync(
  SCRIPT_META,
  JSON.stringify({topic, model: MODEL, words: scriptText.split(/\s+/).length, map: true}, null, 2),
);

const wc = scriptText.split(/\s+/).length;
console.log(`[map-script] OK — ${wc} parole (~${(wc / 150 * 60).toFixed(0)}s a 150wpm)`);
console.log(`[map-script] banner: "${bannerText}"`);
console.log(`[map-script] → src/script.txt, src/banner.json`);
