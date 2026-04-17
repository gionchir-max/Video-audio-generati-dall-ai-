import 'dotenv/config';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const SCRIPT_TXT = path.join(ROOT, 'src', 'script.txt');
const WORDS_JSON = path.join(ROOT, 'src', 'words.json');
const FACTS_JSON = path.join(ROOT, 'src', 'facts.json');
const META_JSON = path.join(ROOT, 'src', 'meta.json');
const PLAN_JSON = path.join(ROOT, 'src', 'map-plan.json');

const FORCE = process.argv.includes('--force');
if (!FORCE && existsSync(PLAN_JSON)) {
  console.log('[map-plan] cache hit → src/map-plan.json (use --force per rigenerare)');
  process.exit(0);
}

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3.2';
if (!API_KEY) {
  console.error('OPENROUTER_API_KEY mancante');
  process.exit(1);
}

const script = readFileSync(SCRIPT_TXT, 'utf8').trim();
const words = JSON.parse(readFileSync(WORDS_JSON, 'utf8'));
const facts = existsSync(FACTS_JSON) ? JSON.parse(readFileSync(FACTS_JSON, 'utf8')) : {};
const meta = JSON.parse(readFileSync(META_JSON, 'utf8'));
const duration = meta.voiceoverDuration;

// Compatta le parole in frasi con timestamp approssimati (usa punctuation)
const sentences = [];
let current = {text: '', start: null, end: null};
for (const w of words) {
  const wStart = w.start ?? w.startInSeconds ?? 0;
  const wEnd = w.end ?? w.endInSeconds ?? wStart;
  const wText = w.word ?? w.text ?? '';
  if (current.start === null) current.start = wStart;
  current.end = wEnd;
  current.text += (current.text ? ' ' : '') + wText;
  if (/[.!?]$/.test(wText)) {
    sentences.push(current);
    current = {text: '', start: null, end: null};
  }
}
if (current.text) sentences.push(current);

const sentenceLines = sentences
  .map((s, i) => `${i}. [${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`)
  .join('\n');

const SYSTEM = `Sei un motion designer specializzato in mappe animate per video TikTok. Ricevi: uno script voice-over italiano, le frasi con timestamp, un dossier di fatti geografici (luoghi, coordinate, rotte). Devi restituire un piano JSON di scene mappa sincronizzate ai timestamp delle frasi. Ogni scena descrive camera (center, zoom, bearing, pitch) ed overlays (pin, linee, poligoni, pulse) che animano visivamente cio che il voice-over sta dicendo.

REGOLE:

1. COPRI TUTTA LA DURATA del voice-over con scene contigue (startTime/endTime, in secondi). Nessun buco. Durata totale = "duration" passata nel prompt.

2. TRANSIZIONI SENSATE. Quando il voice-over cambia luogo, la camera deve muoversi LI' (easing fluido). Quando il voice-over parla di una rotta (es. "dal Qatar all'Europa"), DEVI disegnare una linea tra i due punti (type: "route"). Quando nomina una citta/stretto/terminale, DEVI mettere un pin con label maiuscola che compare con fade-in appena viene nominato.

3. CAMERA. Ogni scena ha camera.start e camera.end (stessi campi: center [lng, lat], zoom, bearing, pitch). Interpolazione lineare. Zoom: 2=mondo, 4=continente, 6=paese, 8=citta, 10=quartiere. Pitch 0=flat, 45=tilt. Usa pitch 30-50 per scene drammatiche; pitch 0 per overview mondiali. Bearing ruota la mappa in gradi. Cambia bearing lentamente (max 30 gradi per scena).

4. OVERLAYS SUPPORTATI:
   - {"type":"pin","lng":X,"lat":Y,"label":"TESTO MAIUSCOLO","appearAt":s} → pin con pulse che compare a appearAt secondi (globali nel video)
   - {"type":"route","coords":[[lng,lat],[lng,lat],...],"label":"NOME ROTTA","startLabel":"CITTA' PARTENZA","endLabel":"CITTA' ARRIVO","drawFrom":s,"drawTo":s,"color":"#00e5ff"} → linea cyan che si disegna da drawFrom a drawTo con pallini e label agli estremi. Usa SEMPRE #00e5ff per le rotte.
   - {"type":"pulse","lng":X,"lat":Y,"appearAt":s,"color":"#hex"} → cerchio pulsante (attacchi, eventi puntuali, colore rosso #ff3b3b)
   - {"type":"highlight","country":"IT","label":"ITALIA","appearAt":s} → paese intero evidenziato col poligono reale riempito con la BANDIERA NAZIONALE. USA SEMPRE QUESTO PER I PAESI: specifica il codice ISO 3166-1 alpha-2 in "country" (IT, DE, FR, ES, RU, IR, QA, SA, AE, EG, LY, DZ, TR, CN, US, GB, NO, SE, FI, DK, NL, BE, PL, UA, KZ, etc.). Non serve passare coords se c'e' country. Label in maiuscolo mostrato al centro del paese.
   - {"type":"label","lng":X,"lat":Y,"text":"+38%","appearAt":s,"size":"lg|md|sm"} → numero/percentuale floattato su mappa (es. "+38%", "60€/MWh", "12.8 MLN T")
   - {"type":"era","text":"28 FEB 2026","appearAt":s,"durationSec":2.5,"position":"top"} → data/anno GIGANTE (200px) mostrato al centro per ~2.5s. Usa per segnare eventi storici importanti: date, anni. position top o bottom per evitare sottotitoli.

5. DENSITA' VISIVA. Almeno 1 overlay per scena, 2-4 durante climax. Ogni pin deve comparire appena il voice-over nomina quel luogo (controlla timestamp frasi). Almeno 3-5 rotte in tutto il video. Almeno 4-6 highlight di paesi (con country ISO code) per colorare la mappa con le bandiere. Usa "era" per TUTTE le date/anni citati nel voiceover (1796, 2026, 28 febbraio 2026, ecc.) - almeno 2-4 era nel video totale.

6. COORDINATE DAL DOSSIER. Usa SEMPRE le coordinate esatte nel dossier "facts.geography". Non inventare. Se un luogo non e nel dossier, puoi usare coordinate note (capitali europee etc.).

7. TIMING DEGLI OVERLAY. "appearAt" deve essere in secondi globali, compreso fra startTime ed endTime della scena. Coord con i timestamp delle frasi.

8. STILE MAPPA: "satellite-hybrid" di default; "dark" per scene drammatiche (guerra, crisi); "streets" per mostrare citta'.

9. OUTPUT: JSON valido, nessun testo fuori.

Shape:
{
  "duration": <secondi>,
  "fps": 30,
  "style": "satellite-hybrid|dark|streets",
  "scenes": [
    {
      "startTime": 0,
      "endTime": 8,
      "description": "breve descrizione",
      "style": "optional override",
      "camera": {
        "start": {"center":[lng,lat],"zoom":N,"bearing":N,"pitch":N},
        "end":   {"center":[lng,lat],"zoom":N,"bearing":N,"pitch":N}
      },
      "overlays": [ ... ]
    },
    ...
  ]
}`;

const USER = `DURATA VOICEOVER: ${duration.toFixed(2)} secondi.

SCRIPT:
"""
${script}
"""

FRASI CON TIMESTAMP (usa questi tempi per sincronizzare gli overlays):
${sentenceLines}

DOSSIER FATTI GEOGRAFICI:
${JSON.stringify(facts, null, 2)}

Genera il piano JSON completo. Pensala come un documentario: apertura mondiale, zoom progressivo, poi viaggio tra i luoghi, rotte che si disegnano, pin che compaiono, numeri floating nei momenti chiave, chiusura con la rivelazione della verita' nascosta (Yamal/Sabetta -> Europa). Copri TUTTI i ${duration.toFixed(1)} secondi.`;

async function call() {
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
      temperature: 0.5,
      response_format: {type: 'json_object'},
      messages: [
        {role: 'system', content: SYSTEM},
        {role: 'user', content: USER},
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

function extractJson(content) {
  try { return JSON.parse(content); } catch {}
  const match = content.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Impossibile estrarre JSON');
}

console.log(`[map-plan] genero piano mappa (${sentences.length} frasi, ${duration.toFixed(1)}s)...`);
const raw = await call();
const plan = extractJson(raw);

// Validazione/sanity
if (!plan.scenes || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
  console.error('[map-plan] piano malformato:', raw.slice(0, 500));
  process.exit(1);
}
plan.duration = plan.duration || duration;
plan.fps = plan.fps || 30;
plan.style = plan.style || 'satellite-hybrid';

// Chiudi eventuali gap: ultimo endTime deve >= duration
const last = plan.scenes[plan.scenes.length - 1];
if (last.endTime < duration - 0.5) {
  console.warn(`[map-plan] ultima scena finisce a ${last.endTime}s < duration ${duration}s — estendo`);
  last.endTime = duration;
}

writeFileSync(PLAN_JSON, JSON.stringify(plan, null, 2));
const totalOverlays = plan.scenes.reduce((n, s) => n + (s.overlays?.length || 0), 0);
console.log(`[map-plan] OK — ${plan.scenes.length} scene, ${totalOverlays} overlay → src/map-plan.json`);
