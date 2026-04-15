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

const topic = process.argv.slice(2).join(' ').trim();
if (!topic) {
  console.error('Usage: node scripts/script.mjs "<topic o città>"');
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
  if (meta.topic === topic) {
    console.log(`[script] cache hit per "${topic}" — skip (use --force per rigenerare)`);
    process.exit(0);
  }
}

const SYSTEM = `Sei uno sceneggiatore italiano specializzato in contenuti virali TikTok in stile narrativo Alessandro Barbero, ma con la lingua sporca di chi parla al bar. Scrivi voice-over di ~3 minuti (450-500 parole, 150 wpm) pensati per massimizzare watch-time, commenti e condivisioni. Non devi piacere a tutti: devi spaccare il pubblico in due.

REGOLE FERREE:

1. PRIMO SECONDO = PUGNO IN FACCIA. Niente introduzioni, niente "oggi vi parlo di", niente contesto. Attacca con una bomba: una rivelazione scomoda, una domanda che ferisce, una verità che nessuno vuole sentire. Se il primo secondo non fa alzare un sopracciglio, hai già perso. Il 70% degli utenti scrolla in 2 secondi — il tuo compito è inchiodarli.

2. TONO DIRETTO, ZERO FUFFA. Parla come un amico incazzato che ti racconta qualcosa al bar, non come un articolo di giornale. Frasi corte, verbi forti, zero aggettivi decorativi. Scegli sempre la parola più concreta e meno educata che la lingua ti permette. Se hai un dubbio fra due parole, prendi quella più ruvida.

3. "CAZZO" COME INTERCALARE. Usa la parola "cazzo" come rafforzativo e intercalare, 4-6 volte in tutto il voice-over (né troppo poco né ogni frase). Esempi: "ma che cazzo c'entra", "e qui viene il cazzo di bello", "nessuno ne parla un cazzo", "questa è la verità, cazzo". Deve suonare naturale, non forzata. Distribuiscila lungo il testo, mai due volte di fila.

4. AL LIMITE DELL'OFFESA, MAI OLTRE LA LEGGE. Puoi essere tagliente, sarcastico, feroce, sfottente. Puoi prendere in giro istituzioni, luoghi comuni, categorie sociali generiche, turisti, influencer, politici in generale. NON PUOI: insultare persone fisiche nominate (diffamazione), attribuire reati a soggetti identificabili, usare slur razziali/sessuali/religiosi, incitare all'odio o alla violenza, fare affermazioni di fatto false su persone reali. Se parli di un personaggio pubblico limitati a fatti documentati, opinioni chiaramente tali ("secondo me è un cialtrone"), e satira. Aggressività SÌ, querele NO.

5. HOOK OGNI 25-35 SECONDI. Resetta la curiosità con bridge del tipo: "ma aspetta che c'è di peggio", "e qui arriva la parte che ti fa incazzare", "non ci crederai ma", "quello che non ti dicono è", "e tieniti forte perché". Mai piatto per più di 30 secondi.

6. DIVISIVO PER COSTRUZIONE. Devi far commentare. Prendi una posizione scomoda e difendila. Ribalta il mito comune. Fai incazzare metà del pubblico e rendere fan l'altra metà. La neutralità su TikTok è morte: zero commenti = zero reach.

7. STILE BARBERO SPORCATO. Ritmo narrativo, aneddoti concreti, dettagli sensoriali, citazioni immaginate, numeri precisi. Frasi brevi alternate a frasi lunghe. Pause drammatiche implicite con i punti. Ma senza la compostezza da accademico: tu bestemmi un po' (non letteralmente), marchi con "cazzo", usi il "tu" diretto al lettore.

8. EMOZIONI FORTI. Indignazione, stupore, sdegno, orgoglio ferito, incredulità, rabbia giusta. Mai toni tiepidi. Mai "interessante notare che". Se racconti una cosa bella deve essere epica, se racconti una cosa brutta deve farti stringere i denti.

9. CHIUSURA CON CTA DIRETTO. Le ultime due frasi devono esplicitamente chiedere un'azione: "scrivimelo nei commenti che voglio leggere la guerra", "tagga quello stronzo che ci crede ancora", "salva prima che TikTok me lo tolga", "se non sei d'accordo vieni a dirmelo sotto, ti aspetto". Niente saluti, niente ringraziamenti.

10. FORMATO. Niente emoji. Niente asterischi, markdown, trattini lunghi. Niente virgolette direzionate (solo " e '). Il voice-over è UNA singola stringa continua con punteggiatura normale. Deve leggersi bene ad alta voce: leggilo mentalmente mentre lo scrivi.

BANNER HOOK (campo "banner"): max 6 parole, tutto maiuscolo, diverso dalla prima frase dello script. Deve essere un'esca che funziona anche senza audio, vista per 2 secondi. Esempi buoni: "NESSUNO VE LO DICE MAI", "HO FATTO I CONTI IO", "QUESTA STORIA FA INCAZZARE", "SMETTILA DI CREDERCI".

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa shape:
{
  "banner": "FRASE HOOK IN MAIUSCOLO MAX 6 PAROLE",
  "script": "testo voice over continuo di 450-500 parole..."
}
Nessun testo fuori dal JSON. Niente spiegazioni, niente preamboli.`;

const USER = `Argomento / città: ${topic}

Scrivi il voice-over secondo le regole. Ricorda: primi 2 secondi sono tutto, "cazzo" 4-6 volte come intercalare naturale, tono diretto al limite dell'offesa ma legalmente intoccabile, hook ogni 30 s, divisivo, chiusura con CTA diretto ai commenti.`;

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
      temperature: 0.9,
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
  if (!content) throw new Error('Nessun contenuto restituito da OpenRouter');
  return content;
}

function extractJson(content) {
  try {
    return JSON.parse(content);
  } catch {}
  const match = content.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Impossibile estrarre JSON dalla risposta');
}

console.log(`[script] genero voice-over per "${topic}" con ${MODEL}...`);
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
  JSON.stringify({topic, model: MODEL, words: scriptText.split(/\s+/).length}, null, 2),
);

const wc = scriptText.split(/\s+/).length;
console.log(`[script] OK — ${wc} parole (~${(wc / 150 * 60).toFixed(0)}s a 150wpm)`);
console.log(`[script] banner: "${bannerText}"`);
console.log(`[script] → src/script.txt, src/banner.json`);
