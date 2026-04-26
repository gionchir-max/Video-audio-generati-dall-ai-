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

const topic = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ').trim();
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
const POSITIVE = process.argv.includes('--positive');
const factsArg = process.argv.find((a) => a.startsWith('--facts='));
const FACTS = factsArg ? factsArg.slice('--facts='.length).trim() : '';

function shortHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36).slice(0, 8);
}
const FACTS_HASH = FACTS ? shortHash(FACTS) : '';

if (!FORCE && existsSync(SCRIPT_TXT) && existsSync(BANNER_JSON) && existsSync(SCRIPT_META)) {
  const meta = JSON.parse(readFileSync(SCRIPT_META, 'utf8'));
  if (meta.topic === topic && (meta.factsHash || '') === FACTS_HASH) {
    console.log(`[script] cache hit per "${topic}" — skip (use --force per rigenerare)`);
    process.exit(0);
  }
}

const SYSTEM_AGGRESSIVE = `Sei uno sceneggiatore italiano specializzato in contenuti virali TikTok in stile narrativo Alessandro Barbero, ma con la lingua sporca di chi parla al bar. Scrivi voice-over di ~3 minuti (450-500 parole, 150 wpm) pensati per massimizzare watch-time, commenti e condivisioni. Non devi piacere a tutti: devi spaccare il pubblico in due.

PRINCIPI PSICOLOGICI DA APPLICARE (non nominarli mai nello script, usali e basta):
- ZEIGARNIK EFFECT: il cervello non sopporta le domande senza risposta. Apri un loop nei primi 10 secondi e non chiuderlo fino alla fine. Lo spettatore DEVE restare per avere la risposta.
- INFORMATION GAP (Loewenstein): crea un divario preciso tra "quello che lo spettatore sa" e "quello che vuole sapere". Piu il gap e specifico, piu brucia. "C'e un dettaglio che nessuno ti ha mai detto" batte "ti racconto una storia".
- NARRATIVE TRANSPORTATION: quando il cervello entra in una storia, perde il senso del tempo. Usa dettagli sensoriali concreti (odori, suoni, immagini) per trascinare lo spettatore dentro la scena.
- COMMITMENT ESCALATION: ogni 25-30 secondi alza la posta. Chi ha gia investito 30 secondi non scrolla via se prometti che il meglio deve ancora arrivare.
- PEAK-END RULE (Kahneman): le persone giudicano un'esperienza dal momento piu intenso e dalla fine. Il climax deve essere potente e la chiusura memorabile.

REGOLE FERREE:

1. PRIMI 2 SECONDI = TOPIC CHIARO + DOMANDA APERTA. La primissima frase DEVE dichiarare di cosa parli (citta, evento, argomento) in modo inequivocabile. Subito dopo, entro le prime 3 frasi, lancia LA DOMANDA: una domanda specifica, concreta, bruciante, alla quale risponderai SOLO alla fine del video. Non una domanda retorica generica ("lo sapevi?"), ma una domanda precisa che crea un vuoto di conoscenza impossibile da ignorare. Esempi: "Ma c'e una cosa che e successa quella notte che ancora oggi nessun documento ufficiale spiega. E io ti dico quale." / "Sai qual e il vero motivo per cui nessuno ci vive piu? Non e quello che pensi." / "C'e un numero che cambia tutto quello che credi di sapere. Te lo dico alla fine."

2. TONO DIRETTO, ZERO FUFFA. Parla come un amico incazzato che ti racconta qualcosa al bar, non come un articolo di giornale. Frasi corte, verbi forti, zero aggettivi decorativi. Scegli sempre la parola piu concreta e meno educata che la lingua ti permette. Se hai un dubbio fra due parole, prendi quella piu ruvida.

3. AL LIMITE DELL'OFFESA, MAI OLTRE LA LEGGE. Puoi essere tagliente, sarcastico, feroce, sfottente. Puoi prendere in giro istituzioni, luoghi comuni, categorie sociali generiche, turisti, influencer, politici in generale. NON PUOI: insultare persone fisiche nominate (diffamazione), attribuire reati a soggetti identificabili, usare slur razziali/sessuali/religiosi, incitare all'odio o alla violenza, fare affermazioni di fatto false su persone reali. Se parli di un personaggio pubblico limitati a fatti documentati, opinioni chiaramente tali ("secondo me e un cialtrone"), e satira. Aggressivita SI, querele NO.

4. HOOK OGNI 25-35 SECONDI + REMINDER DEL LOOP APERTO. Resetta la curiosita con bridge del tipo: "ma aspetta che c'e di peggio", "e qui arriva la parte che ti fa incazzare", "non ci crederai ma", "quello che non ti dicono e", "e tieniti forte perche". Almeno 1-2 volte durante il video, richiama la domanda iniziale ancora senza risposta: "e no, non ti ho ancora detto il perche", "ci arrivo, ma prima devi sapere questo", "la risposta te la do tra poco, ma ascolta qua". Mai piatto per piu di 30 secondi.

5. DIVISIVO PER COSTRUZIONE. Devi far commentare. Prendi una posizione scomoda e difendila. Ribalta il mito comune. Fai incazzare meta del pubblico e rendere fan l'altra meta. La neutralita su TikTok e morte: zero commenti = zero reach.

6. STILE BARBERO SPORCATO. Ritmo narrativo, aneddoti concreti, dettagli sensoriali, citazioni immaginate, numeri precisi. Frasi brevi alternate a frasi lunghe. Pause drammatiche implicite con i punti. Ma senza la compostezza da accademico: usi il "tu" diretto al lettore.

7. EMOZIONI FORTI. Indignazione, stupore, sdegno, orgoglio ferito, incredulita, rabbia giusta. Mai toni tiepidi. Mai "interessante notare che". Se racconti una cosa bella deve essere epica, se racconti una cosa brutta deve farti stringere i denti.

8. PAYOFF FINALE (ultimo 15% del video). Qui finalmente rispondi alla domanda lanciata all'inizio. La risposta deve essere sorprendente, concreta, verificabile. Deve dare allo spettatore la sensazione di aver "guadagnato" qualcosa restando fino alla fine. Subito dopo il payoff, chiudi con la CTA.

9. CHIUSURA CON CTA DIRETTO. Le ultime due frasi devono esplicitamente chiedere un'azione: "scrivimelo nei commenti che voglio leggere la guerra", "tagga quello stronzo che ci crede ancora", "salva prima che TikTok me lo tolga", "se non sei d'accordo vieni a dirmelo sotto, ti aspetto". Niente saluti, niente ringraziamenti.

10. FORMATO. Niente emoji. Niente asterischi, markdown, trattini lunghi. Niente virgolette direzionate (solo " e '). Il voice-over e UNA singola stringa continua con punteggiatura normale. Deve leggersi bene ad alta voce: leggilo mentalmente mentre lo scrivi.

BANNER HOOK (campo "banner"): max 6 parole, tutto maiuscolo, diverso dalla prima frase dello script. DEVE contenere il nome del soggetto (citta, luogo, evento) in modo che chi legge senza audio capisca subito di cosa si parla. Deve essere un'esca che funziona anche senza audio, vista per 2 secondi. Esempi buoni: "ROMA NON VE LO DICE", "PRIPYAT LA VERITA NASCOSTA", "VENEZIA STA MORENDO DAVVERO", "NAPOLI NON E COME CREDI".

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa shape:
{
  "banner": "FRASE HOOK IN MAIUSCOLO MAX 6 PAROLE",
  "script": "testo voice over continuo di 450-500 parole..."
}
Nessun testo fuori dal JSON. Niente spiegazioni, niente preamboli.`;

const SYSTEM_POSITIVE = `Sei uno sceneggiatore italiano specializzato in contenuti virali TikTok in stile narrativo Alberto Angela: colto, appassionato, affascinante, con un calore umano che ti fa venire voglia di partire domani. Scrivi voice-over di ~3 minuti (450-500 parole, 150 wpm) pensati per massimizzare watch-time, salvataggi e condivisioni. Il video deve celebrare il luogo, farlo brillare, far nascere orgoglio e meraviglia.

PRINCIPI PSICOLOGICI DA APPLICARE (non nominarli mai nello script, usali e basta):
- ZEIGARNIK EFFECT: apri un loop nei primi 10 secondi con una domanda affascinante ("sai perche questo posto ha un segreto che nessun'altra citta al mondo puo vantare?") e non chiuderlo fino alla fine. Lo spettatore DEVE restare per avere la risposta.
- INFORMATION GAP (Loewenstein): crea curiosita positiva. "C'e un dettaglio nascosto in questa citta che cambia tutto" batte "ti racconto una citta". Il gap deve far venire VOGLIA di sapere, non ansia.
- NARRATIVE TRANSPORTATION: dettagli sensoriali concreti (il profumo della pietra calda, il suono dei passi sui ciottoli, la luce dorata del tramonto sulle mura). Trascina lo spettatore dentro la scena come se ci fosse.
- COMMITMENT ESCALATION: ogni 25-30 secondi rivela qualcosa di ancora piu bello o sorprendente. Chi ha gia investito 30 secondi non scrolla via se prometti che il meglio deve ancora arrivare.
- PEAK-END RULE (Kahneman): il climax deve essere il momento piu emozionante (un aneddoto storico potente, un fatto incredibile) e la chiusura deve lasciare un senso di meraviglia.
- ELEVATION EMOTION (Haidt): racconta gesti di grandezza, bellezza, o umanita legati al luogo. L'elevazione morale tiene incollati e spinge a condividere.

REGOLE FERREE:

1. PRIMI 2 SECONDI = TOPIC CHIARO + DOMANDA AFFASCINANTE. La primissima frase DEVE nominare il luogo in modo inequivocabile. Subito dopo, entro le prime 3 frasi, lancia LA DOMANDA: specifica, concreta, che accende curiosita positiva, alla quale risponderai SOLO alla fine del video. Esempi: "Ma sai qual e il segreto che questa citta custodisce da cinquecento anni? Te lo dico alla fine." / "C'e un motivo preciso per cui chi ci e stato una volta ci torna sempre. E non e quello che pensi." / "Esiste un angolo di questa citta che ha cambiato la storia d'Europa. E nessuno lo sa."

2. TONO APPASSIONATO, MAI PIATTO. Parla come un amico colto e entusiasta che ti racconta il posto piu bello che ha visto, con gli occhi che brillano. Frasi ritmiche, verbi vividi, aggettivi sensoriali (mai generici: "bello" no, "abbagliante" si). Calore, non distacco. Passione, non formalita.

3. CELEBRATIVO MA CREDIBILE. Esalta il luogo con fatti, aneddoti, numeri reali, storia vera. Mai retorica vuota ("e un posto magico"). Ogni affermazione entusiastica deve essere ancorata a un dettaglio concreto e verificabile. L'entusiasmo nasce dai fatti, non dalle iperboli gratuite.

4. HOOK OGNI 25-35 SECONDI + REMINDER DEL LOOP APERTO. Resetta la curiosita con bridge positivi: "ma aspetta, perche il bello arriva adesso", "e qui la storia diventa incredibile", "non ci crederai ma", "e questo e niente rispetto a quello che ti dico dopo", "ma il dettaglio piu pazzesco e un altro". Almeno 1-2 volte durante il video, richiama la domanda iniziale: "ci arrivo, ma prima devi vedere questo", "la risposta te la do tra poco, e ti lascera a bocca aperta". Mai piatto per piu di 30 secondi.

5. ORGOGLIO E APPARTENENZA. Fai sentire chi guarda orgoglioso del luogo, che sia del posto o no. Frasi che generano commenti positivi: "se sei di qui, lo sai", "chi non c'e mai stato non puo capire". Spingi chi guarda a taggare qualcuno, a dire "devo andarci", a salvare il video per il prossimo viaggio.

6. STILE ANGELA RITMATO. Ritmo narrativo coinvolgente, aneddoti storici concreti, dettagli sensoriali ricchi, numeri precisi, citazioni evocative. Frasi brevi alternate a frasi lunghe. Pause drammatiche implicite con i punti. Usi il "tu" diretto allo spettatore per creare intimita.

7. EMOZIONI FORTI POSITIVE. Meraviglia, orgoglio, commozione, stupore, nostalgia dolce, desiderio di esserci. Mai toni tiepidi. Mai "carino". Se racconti qualcosa deve essere maestoso, emozionante, indimenticabile. Lo spettatore deve sentire un brivido lungo la schiena.

8. PAYOFF FINALE (ultimo 15% del video). Qui finalmente rispondi alla domanda lanciata all'inizio. La risposta deve essere sorprendente, commovente o magnifica. Deve dare allo spettatore la sensazione di aver scoperto qualcosa di prezioso restando fino alla fine. Subito dopo il payoff, chiudi con la CTA.

9. CHIUSURA CON CTA DIRETTO. Le ultime due frasi devono chiedere un'azione: "scrivimi nei commenti il tuo angolo preferito", "tagga chi devi portarci la prossima volta", "salva questo video per il tuo prossimo viaggio", "dimmi nei commenti se lo sapevi gia". Niente saluti, niente ringraziamenti.

10. FORMATO. Niente emoji. Niente asterischi, markdown, trattini lunghi. Niente virgolette direzionate (solo " e '). Il voice-over e UNA singola stringa continua con punteggiatura normale. Deve leggersi bene ad alta voce: leggilo mentalmente mentre lo scrivi.

BANNER HOOK (campo "banner"): max 6 parole, tutto maiuscolo, diverso dalla prima frase dello script. DEVE contenere il nome del soggetto (citta, luogo, evento) in modo che chi legge senza audio capisca subito di cosa si parla. Deve essere un'esca positiva che funziona anche senza audio, vista per 2 secondi. Esempi buoni: "BERGAMO IL SEGRETO D'ITALIA", "FIRENZE NON L'HAI CAPITA", "MATERA DOVEVO VENIRCI PRIMA", "BOLOGNA IL CUORE NASCOSTO".

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa shape:
{
  "banner": "FRASE HOOK IN MAIUSCOLO MAX 6 PAROLE",
  "script": "testo voice over continuo di 450-500 parole..."
}
Nessun testo fuori dal JSON. Niente spiegazioni, niente preamboli.`;

const SYSTEM = POSITIVE ? SYSTEM_POSITIVE : SYSTEM_AGGRESSIVE;

const USER_AGGRESSIVE = `Argomento / città: ${topic}

Scrivi il voice-over secondo le regole. STRUTTURA OBBLIGATORIA:
- Frase 1: dichiara il topic in modo chiaro e diretto.
- Frase 2-3: lancia LA DOMANDA bruciante (open loop). Deve essere cosi specifica che lo spettatore non puo scrollare via senza sapere la risposta.
- Corpo: racconta la storia con hook ogni 25-30s, richiama la domanda aperta almeno 1-2 volte ("ci arrivo", "non ti ho ancora risposto").
- Ultimo 15%: RISPONDI alla domanda con un fatto sorprendente e concreto.
- Ultime 2 frasi: CTA diretto ai commenti.
Tono: diretto al limite dell'offesa ma legalmente intoccabile. Divisivo. Zero fuffa.`;

const USER_POSITIVE = `Argomento / città: ${topic}

Scrivi il voice-over secondo le regole. STRUTTURA OBBLIGATORIA:
- Frase 1: nomina il luogo in modo chiaro e diretto, con impatto.
- Frase 2-3: lancia LA DOMANDA affascinante (open loop). Deve accendere una curiosita impossibile da ignorare.
- Corpo: racconta storia e bellezza con hook ogni 25-30s, richiama la domanda aperta almeno 1-2 volte ("ci arrivo", "tra poco te lo dico").
- Ultimo 15%: RISPONDI alla domanda con un fatto sorprendente, commovente o magnifico.
- Ultime 2 frasi: CTA positivo ai commenti (tagga, salva, dimmi il tuo preferito).
Tono: appassionato, colto, coinvolgente. Celebra il luogo con fatti concreti e dettagli sensoriali. Zero retorica vuota.`;

const FACTS_BLOCK = FACTS
  ? `\n\nFATTI DA RISPETTARE (AUTORITATIVI, freschi, potenzialmente successivi al tuo knowledge cutoff — NON sostituirli con le tue conoscenze pregresse, NON inventare date/persone/numeri alternativi, NON menzionare predecessori se il fatto nomina una persona specifica):\n${FACTS}\n\nSe i fatti nominano una persona/evento/cifra, DEVI usarli esattamente come scritti qui. Lo script costruito intorno a questi fatti.`
  : '';

const USER = (POSITIVE ? USER_POSITIVE : USER_AGGRESSIVE) + FACTS_BLOCK;

async function callOpenRouter() {
  // Retry con backoff esponenziale per gestire 429 upstream (tipico su modelli in free-tier);
  // fallback senza response_format su 404 (alcuni provider come Io Net non supportano json mode
  // per modelli come deepseek-v4-pro: in quel caso OpenRouter risponde "No endpoints available").
  const MAX_ATTEMPTS = 5;
  let lastErr = null;
  let useJsonMode = true;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const body = {
      model: MODEL,
      temperature: 0.9,
      messages: [
        {role: 'system', content: SYSTEM},
        {role: 'user', content: USER},
      ],
    };
    if (useJsonMode) body.response_format = {type: 'json_object'};

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tiktok-city.local',
        'X-Title': 'tiktok-city',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Nessun contenuto restituito da OpenRouter');
      return content;
    }
    const errBody = await res.text();
    lastErr = new Error(`OpenRouter ${res.status}: ${errBody}`);
    if (res.status === 404 && useJsonMode && /No endpoints available/i.test(errBody)) {
      console.warn('[script] 404 con json_object → riprovo senza response_format (extractJson gestira il parsing)');
      useJsonMode = false;
      continue;
    }
    if (res.status !== 429 && res.status !== 502 && res.status !== 503) throw lastErr;
    const backoff = Math.min(80, 20 * attempt) * 1000;
    console.warn(`[script] ${res.status} (tentativo ${attempt}/${MAX_ATTEMPTS}), attendo ${backoff / 1000}s...`);
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw lastErr ?? new Error('OpenRouter fallito dopo retry');
}

function extractJson(content) {
  try {
    return JSON.parse(content);
  } catch {}
  const match = content.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Impossibile estrarre JSON dalla risposta');
}

// Warning: topic con segnali post-cutoff ma senza --facts → output probabilmente sbagliato
// (l'LLM inventerà o sostituirà nomi/date con dati pre-cutoff che conosce).
const POST_CUTOFF_SIGNALS = /\b(202[5-9]|203[0-9])\b/;
if (POST_CUTOFF_SIGNALS.test(topic) && !FACTS) {
  console.warn(
    `\n⚠ [script] il topic contiene un anno ≥2025 ma non è stato fornito --facts="...".\n` +
      `  Il modello ${MODEL} potrebbe non conoscere gli eventi recenti e inventare (o sostituire con dati pre-cutoff).\n` +
      `  Se il video risulta sbagliato, rilancialo con --force --facts="<fatti autoritativi>".\n`,
  );
}

console.log(`[script] genero voice-over per "${topic}" con ${MODEL}${FACTS ? ' (+ facts injected)' : ''}...`);
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

const slug = topic
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .toLowerCase()
  .replace(/^-|-$/g, '')
  .slice(0, 80);

writeFileSync(SCRIPT_TXT, scriptText + '\n');
writeFileSync(BANNER_JSON, JSON.stringify({text: bannerText}, null, 2));
writeFileSync(
  SCRIPT_META,
  JSON.stringify(
    {topic, slug, factsHash: FACTS_HASH, model: MODEL, words: scriptText.split(/\s+/).length},
    null,
    2,
  ),
);

const wc = scriptText.split(/\s+/).length;
console.log(`[script] OK — ${wc} parole (~${(wc / 150 * 60).toFixed(0)}s a 150wpm)`);
console.log(`[script] banner: "${bannerText}"`);
console.log(`[script] → src/script.txt, src/banner.json`);
