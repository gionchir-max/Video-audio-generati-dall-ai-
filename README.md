# Video AI Pipeline — generatore video TikTok da una storia

Pipeline per generare video TikTok 1080×1920 a partire da una **storia testuale**.
Riutilizzabile per qualsiasi argomento. Gli ingredienti vengono assemblati così:

```
storia (testo) ─► VO neural italiano (edge-tts, gratis) ─┐
                                                          ├─► render Remotion ─► video finale 1080×1920
clip 9:16 (meta.ai, manuali) ─► concat + normalizza ─────┘
```

Stack: **Remotion** (React → MP4), **Microsoft Edge TTS** (voce neural italiana, $0), **ffmpeg-static**, clip video da **Meta AI** (manuali).

---

## Setup (one-shot)

```bash
npm install
pip3 install --user edge-tts        # TTS neural italiano gratis
```

Niente API key obbligatoria. ffmpeg/ffprobe sono inclusi via npm.

---

## Workflow per un nuovo video

### 1. Inizializza
```bash
npm run video:init <slug> "TITOLO BANNER"
# es:
npm run video:init mente-stoica "STOICI: COME SMETTERE DI SOFFRIRE"
```
Crea:
```
videos/<slug>/
├── story.txt    ← scrivi qui il testo VO (italiano)
├── meta.json    ← config (banner, voce, musica)
└── clips/       ← qui andranno 01.mp4, 02.mp4, ...
```

### 2. Scrivi la storia in `videos/<slug>/story.txt`
Italiano fluido, paragrafi separati da riga vuota. Cadenza ~2.5 char/sec di edge-tts:
- 500 char ≈ 30s
- 2.000 char ≈ 2 min
- 3.000 char ≈ 3 min

### 3. Genera le clip su meta.ai
1. Vai su https://meta.ai/, clicca **"Crea video"**
2. Per ogni segmento (~5-6s di video) invia un prompt visuale che descriva la scena
3. Scarica il video in `videos/<slug>/clips/01.mp4`, `02.mp4`, … (zero-padded a 2 cifre)
4. Le clip devono essere **9:16** (480×832 va bene, lo script normalizza a 1080×1920)
5. Servono **N = ceil(durata_VO / durata_clip)** clip per coprire tutto il VO

### 4. Render finale
```bash
npm run video <slug>
```
Lo script automaticamente:
1. genera `audio/voiceover.mp3` con edge-tts (voce **`it-IT-GiuseppeMultilingualNeural`** di default)
2. normalizza tutte le clip a 1080×1920 30fps h264
3. concatena le clip in `bg.mp4`
4. copia gli asset in `public/videos/<slug>/`
5. lancia Remotion render della composition `EdgeStory` → `videos/<slug>/out/final.mp4`

Output: `videos/<slug>/out/final.mp4` (1080×1920, h264+aac).

---

## Pipeline V2 — allineamento clip-VO automatico (raccomandata)

La V1 sopra concatena le clip in ordine fisso (5.21s ciascuna). Se il VO ha frasi di durata variabile, le clip vanno in **anticipo** o **ritardo** sul testo (drift accumulato fino a -36s su video lunghi).

La **V2** allinea ogni clip alla durata reale della sua frase nel VO. **No time-stretch, no freeze frame**. Per le frasi più lunghe di 5.6s, genera automaticamente prompt B-roll (visual diversi della stessa scena → cut filmico).

### Workflow V2

**Prerequisiti**: una sessione Chrome con CDP esposto su `localhost:50041` loggata su meta.ai.
Avvio Chrome dedicato (profilo separato per non toccare il main):
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=50041 \
  --user-data-dir="/Volumes/Extreme SSD/Video Claude/tiktok-city/.chrome-meta-profile" \
  --no-first-run --no-default-browser-check \
  "https://www.meta.ai/" &
```
Fai login a meta.ai una volta sola, il profilo persiste.

**Whisper.cpp medium model** (1.5GB, una sola volta):
```bash
cd whisper.cpp && bash models/download-ggml-model.sh medium
```

### Step 1 — Crea i 3 file sorgente in `videos/<slug>/`

**`story.txt`** — il VO. Una frase per paragrafo (separati da riga vuota). Ogni paragrafo diventa un **prompt visuale** distinto. Target ~2.5 parole/sec a +25% rate Diego, quindi:
- 180s (3min) ≈ 450 parole ≈ 32-38 frasi
- 280s ≈ 700 parole ≈ 55-65 frasi
- 350s ≈ 850 parole ≈ 70 frasi

Apri con un **hook di 2 secondi** che catturi l'attenzione (curiosity gap, citazione choc, statistica), NON con "Nel 1921 nasce…".

**`meta.json`**:
```json
{
  "banner": "TITOLO IN MAIUSCOLO",
  "bannerSeconds": 10,
  "voice": "it-IT-DiegoNeural",
  "rate": "+25%",
  "music": "music.mp3",
  "musicVolume": 0.15
}
```

**`prompts.md`** — bibbia personaggio + 1 prompt visuale per ogni frase di story.txt. Pattern:

```markdown
**Stile globale**: HYPER-SATURATED colors, vivid <palette>, photorealistic cinematic, Canon EOS R5, 9:16 vertical, no text, no captions

**Bibbia personaggio <X>**: "<descrizione completa con tratti distintivi>"

**01** — _"<frase 1 letterale dal story.txt>"_
> 5-second cinematic video clip: hyper-saturated colors, <wide/medium/close-up>, <verbo movimento camera>, <descrizione scena>, vivid <colori>, photorealistic cinematic, Canon EOS R5, 9:16 vertical

**02** — _"<frase 2>"_
> 5-second cinematic video clip: ...
```

**Regole tassative prompts** (vedi `docs/meta-video-pipeline.md`):
- Ogni prompt INIZIA con `5-second cinematic video clip: hyper-saturated colors,`
- Almeno **1 verbo di movimento** (push-in, tracking, tilt-down, drone)
- **Linguaggio neutro** — mai nominare persone reali (al posto di "Berlusconi", scrivi "the silver-haired Italian tycoon")
- Per personaggi riconoscibili, dare descrizione **fisica dettagliata** (capelli, viso, occhi, naso, espressione, abbigliamento)

**Crea il runner** `scripts/_run-<slug>.mjs` (clona da `_run-wojtyla.mjs`, aggiorna `SLUG`).

### Step 2 — Genera VO + plan automatico

```bash
node scripts/make-video.mjs <slug>
```
Lo step 1 ora fa **3 cose in automatico**:
1. **edge-tts** genera `voiceover-raw.mp3` (originale con pause naturali)
2. **silence-trim**: rimuove tutti i silenzi >0.2s da `voiceover-raw.mp3` e salva `voiceover.mp3` (tipico risparmio -20-25%)
3. **whisper + clip-plan**: trascrive il VO compresso, mappa frasi→timestamps, calcola n_clips per frase, **auto-appende** B-roll prompts a `prompts.md`

Se mancano clip rispetto al plan, lo step si ferma con messaggio:
```
⚠ Mancano N clip su M. Aggiorna TOTAL_CLIPS=M in scripts/_run-<slug>.mjs e lancia:
  node scripts/_run-<slug>.mjs
Poi rilancia: npm run video <slug>
```

### Configurazione silence-trim (opzionale)

Default: rimuovi tutti i silenzi >0.2s (massimo punch TikTok). Per disabilitare o personalizzare nel `meta.json`:
```json
{
  "silenceTrim": true,           // false = niente trim, mantieni pause naturali
  "silenceMinDur": 0.2,          // soglia silenzio in secondi
  "silenceThresholdDb": -40      // soglia dB
}
```

Per opzione "cappa silenzi >0.4s a 0.2s" (mantieni respiri brevi) usa lo script `_silence-cap.py`:
```bash
python3 scripts/_silence-cap.py voiceover-raw.mp3 voiceover.mp3 --detect-dur 0.4 --cap-dur 0.2
```

### Step 3 — Aggiorna runner e genera clip mancanti

Aggiorna `scripts/_run-<slug>.mjs` con `const TOTAL_CLIPS = N` (numero stampato dallo step 1).

```bash
node scripts/_run-<slug>.mjs
```
Apre meta.ai via CDP, una chat ogni 3 clip (workaround freeze bottone "Invia"), scarica le 4 varianti generate per ogni prompt e tiene la prima. Riprende da dove si era fermato (state.json).

### Step 4 — Render finale

```bash
npm run video <slug>
```
Ora che le clip ci sono tutte, `make-video.mjs` continua: **concat aligned** (per ogni frase trim le sue clip a `dur/n_clips` esatti), poi render Remotion.

Output: `videos/<slug>/out/final.mp4`, perfettamente sincrono al VO frame per frame, senza time-stretch né freeze.

### Sintesi: 3 comandi

```bash
# 1. VO + silence-trim + whisper + plan + B-roll auto-append (si ferma se mancano clip)
node scripts/make-video.mjs <slug>

# 2. Aggiorna TOTAL_CLIPS in _run-<slug>.mjs col numero stampato sopra, poi:
node scripts/_run-<slug>.mjs

# 3. Concat aligned + render
npm run video <slug>
```

### Esempi V2

- `videos/agnelli/` — 70 frasi, 70+34=104 clip, 5:50min
- `videos/wojtyla/` — 32 frasi, 33+19=52 clip, 3:00min

---

## Configurazione `videos/<slug>/meta.json`

```json
{
  "banner": "TITOLO BANNER",
  "bannerSeconds": 10,
  "voice": "it-IT-DiegoNeural",
  "rate": "+15%",
  "music": "music.mp3",
  "musicVolume": 0.15,
  "foreignTerms": {
    "en-US": ["Italian Sea Group", "Maltese Falcon", "Boeing"],
    "de-DE": ["Körber"]
  }
}
```

| chiave | default | note |
|---|---|---|
| `banner` | `"TITOLO"` | Testo del box bianco mostrato in alto nei primi `bannerSeconds`. Uppercase consigliato. |
| `bannerSeconds` | `10` | Durata banner in secondi. Fade-out negli ultimi 0.4s. |
| `voice` | `it-IT-DiegoNeural` | Voce edge-tts. **Pure italiana raccomandata** (vedi sotto). Altre IT: `it-IT-GiuseppeMultilingualNeural` (multilingua, sconsigliata), `it-IT-IsabellaNeural`, `it-IT-ElsaNeural`. |
| `rate` | `+15%` | Velocità edge-tts. Diego è ~10% più lento di Giuseppe; `+15%` Diego ≈ `+7%` Giuseppe. |
| `music` | `music.mp3` | Musica in `public/`. Metti `null` per nessuna musica. |
| `musicVolume` | `0.15` | 0.0 – 1.0. |
| `foreignTerms` | `null` | Mappa `{lang: [terms]}` per pronuncia nativa di brand/nomi propri stranieri (vedi sotto). |
| `voiceEn` | `en-US-AndrewNeural` | Voce per i termini `en-US` in `foreignTerms`. |
| `voiceDe` | `de-DE-ConradNeural` | Voce per `de-DE`. |
| `voiceFr` | `fr-FR-HenriNeural` | Voce per `fr-FR`. |

### Voce italiana: perché Diego e non Giuseppe

`it-IT-GiuseppeMultilingualNeural` è una voce **multilingua** che auto-detecta la lingua parola per parola. Su parole italiane meno frequenti (`Manovrare`, `Issare`, ecc.) sbaglia il detect e le pronuncia con fonetica inglese — risultato biascicato.

`it-IT-DiegoNeural` è pura italiana, sempre coerente. Però pronuncia i brand stranieri (es. *Maltese Falcon*) con accento italiano. Per avere il meglio dei due mondi, il pipeline supporta `foreignTerms`: Diego pronuncia tutto l'italiano, e per ogni brand straniero il VO viene **spliciato** con audio generato da una voce nativa di quella lingua, allineato per timestamp tramite WordBoundary di edge-tts.

Esempio: la frase *"Italian Sea Group acquista Perini Navi"* viene generata come:
1. Diego pronuncia tutta la frase in italiano (con "Italian Sea Group" italianizzato)
2. Andrew (en-US) pronuncia separatamente "Italian Sea Group"
3. Il segmento di Andrew sostituisce il segmento di Diego nel timestamp esatto

Il pipeline (`scripts/_tts-multilingual.py`) si attiva automaticamente quando `meta.json` contiene `foreignTerms`. Senza quella chiave usa edge-tts CLI standard.

Per ascoltare campioni di tutte le voci IT:
```bash
~/Library/Python/3.12/bin/edge-tts --voice it-IT-DiegoNeural --text "Test della voce." --write-media diego.mp3
~/Library/Python/3.12/bin/edge-tts --voice it-IT-IsabellaNeural --text "Test della voce." --write-media isabella.mp3
# ecc.
```

---

## Composition `EdgeStory`

Definita in `src/EdgeStory.tsx`, registrata in `src/Root.tsx`.
Layer (dal basso):
1. **bg.mp4** — clip concatenati 1080×1920
2. **gradient overlay** cinematico (top + bottom)
3. **voiceover.mp3** (Audio principale)
4. **music.mp3** in loop a volume basso (Audio, opzionale)
5. **TopBanner** — box bianco con testo nero in alto, fade-out

Anteprima live in browser:
```bash
npm run studio
```

---

## Esempio incluso

`videos/seduzione-greene/` — primo video di esempio:
- `story.txt`: ~3.000 char, riassunto "Le 24 leggi della seduzione" di Robert Greene
- `meta.json`: voce Giuseppe, banner `GREENE: COME FARLA PENSARE A TE`
- 42 clip da meta.ai → 210s di video finale

Gli asset (clip mp4, audio, render finale) sono **esclusi dal repo** (vedi `.gitignore`). Per rigenerarli:
1. Genera tu i 42 clip su meta.ai con i prompt in `nooland-campaign/videos/seduzione-greene/prompts.md`
2. Mettili in `videos/seduzione-greene/clips/01.mp4..42.mp4`
3. `npm run video seduzione-greene`

---

## Comandi rapidi

| Comando | Cosa fa |
|---|---|
| `npm run video:init <slug> "TITOLO"` | Crea scaffold cartella nuovo video |
| `npm run video <slug>` | Pipeline completa: VO + concat + render |
| `npm run studio` | Apre Remotion Studio (preview live in browser) |
| `npx remotion render EdgeStory out/test.mp4 --props='{...}'` | Render diretto con props inline |

---

## Pipeline alternative (legacy)

Il repo include anche pipeline più vecchie/specializzate, NON necessarie per il workflow base sopra:

### Pipeline drone/montage (composition `MainVideo`)
Genera reel da YouTube + ElevenLabs + Whisper. Richiede `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`. Vedi `scripts/make.mjs`, `scripts/script.mjs`, `scripts/tts.mjs`.
```bash
npm run make -- "Roma"                                        # drone footage
npm run make -- "Sgarbi" --montage="Sgarbi intervista" --positive
npm run make-map -- "<topic>"                                 # mappa animata MapLibre
```

### Pipeline Nooland-campaign (composition `MetaAiAd`)
Campagna 18 video per agritech siciliana. Vedi `nooland-campaign/SETUP-MCP.md`.
```bash
npm run produce <slug>                                        # render Nooland Ad
```

Le `.env` per le pipeline legacy sono documentate in `.env.example`.

---

## Struttura

```
scripts/
  make-video.mjs      # ★ orchestratore EdgeStory (pipeline principale)
  init-video.mjs      # ★ scaffold nuovo video
  make.mjs            # legacy: pipeline drone/montage
  music.mjs           # loop + loudnorm musica
  download.mjs        # yt-dlp drone/montage
  ...
src/
  EdgeStory.tsx       # ★ composition Remotion parametrica (pipeline principale)
  TopBanner.tsx       # box bianco titolo
  MainVideo.tsx       # legacy: composition drone
  MetaAiAd.tsx        # legacy: composition Nooland
  Root.tsx            # registra tutte le composition
videos/
  <slug>/             # ogni video ha qui la sua cartella
    story.txt
    meta.json
    clips/01.mp4..NN.mp4
    audio/voiceover.mp3   (generato)
    bg.mp4                (generato)
    out/final.mp4         (generato)
public/
  music.mp3           # musica di sottofondo (FableForte "Whodunit")
  videos/<slug>/      # asset copiati per Remotion staticFile (generati)
```

---

## License

Codice MIT. Voci edge-tts: [Microsoft Cognitive Services Terms](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/). Musica `public/music.mp3`: verificare licenza singola traccia.
