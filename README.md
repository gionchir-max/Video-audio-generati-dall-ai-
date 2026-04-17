# tiktok-city

Pipeline end-to-end per generare reel TikTok (1080×1920, ~3 min) a partire da un nome di città o da un argomento. Due stili disponibili:

**1. Drone footage style** — sottofondo con riprese drone da YouTube
```bash
npm run make -- "Roma"
npm run make -- "la caduta dell'impero romano"
```

**2. Mappa animata style** — sottofondo con MapTiler + MapLibre GL, animazioni editoriali (bandiere nazionali, rotte gasdotti/commerciali, date giganti, pin con pulse, poligoni paesi)
```bash
# crea prima src/facts.json con il dossier geografico del topic (vedi esempio)
npm run make-map -- "Come la guerra con l'Iran ha rivelato una verità sul gas"
```

Output in `out/<topic>.mp4`.

## API key necessarie

Le chiavi vanno in un file `.env` nella root del progetto (partendo da `.env.example`):

```bash
cp .env.example .env
```

| Variabile | Obbligatoria | Dove prenderla | A cosa serve |
|---|---|---|---|
| `OPENROUTER_API_KEY` | sì | https://openrouter.ai/keys | Generazione script voice-over via DeepSeek (`deepseek/deepseek-v3.2`). Usata anche per suggerire la location di ricerca drone. |
| `OPENROUTER_MODEL` | no | — | Default `deepseek/deepseek-v3.2`. Override se vuoi un altro modello OpenRouter. |
| `ELEVENLABS_API_KEY` | sì | https://elevenlabs.io → Profile → API Keys | TTS del voice-over. Basta il permesso `text_to_speech`. |
| `ELEVENLABS_VOICE_ID` | sì | elevenlabs.io → Voices → clic sulla voce → Copy ID | Voce usata dal TTS (es. `pNInz6obpgDQGcFmaJgB`). |
| `ELEVENLABS_MODEL_ID` | no | — | Default `eleven_multilingual_v2`. |
| `ELEVENLABS_STABILITY` | no | — | Default `0.4`. |
| `ELEVENLABS_SIMILARITY` | no | — | Default `1.0`. |
| `ELEVENLABS_STYLE` | no | — | Default `0.5`. |
| `ELEVENLABS_SPEAKER_BOOST` | no | — | Default `true`. |
| `ELEVENLABS_SPEED` | no | — | Default `1.0`. |
| `ELEVENLABS_OUTPUT_FORMAT` | no | — | Default `mp3_44100_128`. |
| `MAPTILER_API_KEY` | sì (solo `make-map`) | https://cloud.maptiler.com/account/keys | Tile raster/vector della mappa nella pipeline `make-map`. Free tier 100k tiles/mese. |

Nessun'altra chiave serve: `yt-dlp` (download video + audio), `whisper.cpp` (trascrizione) e `ffmpeg` girano tutti in locale e vengono installati automaticamente come dipendenze npm (`youtube-dl-exec`, `@remotion/install-whisper-cpp`, `ffmpeg-static`).

## Setup

```bash
npm install          # installa Remotion, ffmpeg-static, yt-dlp, Whisper runner
cp .env.example .env # incolla le tue chiavi
```

La prima esecuzione scarica anche il modello Whisper `small` (~480 MB) e il binario Chrome Headless di Remotion. Le run successive riusano la cache.

## Musica di sottofondo

`scripts/music.mjs` usa **sempre** la traccia locale hardcoded:

```
/Volumes/Extreme SSD/Video Claude/Cinematic Epic Music by Infraction [No Copyright Music] Action(mp3j.cc).mp3
```

La traccia viene loopata se più corta del video e normalizzata a `−14 LUFS`. Se vuoi usare un altro file, modifica `SRC_MUSIC` in `scripts/music.mjs`.

## Comandi

```bash
# Pipeline drone (default)
npm run make -- "<topic>"                # drone footage + voice-over + sub + musica + SFX
npm run make -- "<topic>" --force        # rigenera cache
npm run studio                           # anteprima interattiva Remotion
npm run render                           # solo remotion render (asset già pronti)

# Pipeline mappa animata
npm run make-map -- "<topic>"            # richiede src/facts.json e MAPTILER_API_KEY
```

Step singoli (utili per debug):

```bash
npm run script -- "<topic>"
npm run tts
npm run download -- "<topic>"
npm run download -- "<topic>" --url=https://www.youtube.com/watch?v=XXXXXXXXXXX
npm run prep
npm run transcribe
npm run align
npm run music
npm run sfx
npm run map-plan -- --force              # rigenera src/map-plan.json (solo map pipeline)
```

## Pipeline mappa animata (`make-map`)

Flusso:
1. `scripts/map-script.mjs` — DeepSeek genera voice-over con `src/facts.json` come dossier, privilegiando toponimi e numeri esatti
2. `tts`, `prep`, `transcribe`, `align` — uguali alla pipeline drone
3. `scripts/map-plan.mjs` — DeepSeek trasforma script + timestamp word-level in `src/map-plan.json`: scene con camera keyframes (center/zoom/bearing/pitch) e overlays
4. `music`, `sfx` — uguali
5. `remotion render MapVideo` — renderizza `src/MapVideo.tsx` (MapLibre GL + MapTiler hybrid) con filtro CSS editoriale e overlay SVG animati per frame

### Tipi di overlay nel plan

- `pin` — cerchio pulsante con label in maiuscolo al punto geografico
- `pulse` — cerchio concentrico espandente (attacchi, eventi puntuali)
- `route` — linea che si disegna da `drawFrom` a `drawTo` con endpoint dot + `startLabel`/`endLabel` (colore default `#00e5ff` cyan)
- `highlight` — poligono paese riempito con la **bandiera nazionale**. Usa `country` (ISO 3166-1 alpha-2, es. `IT`, `RU`, `IR`, `QA`, `EU`), lo shape viene preso da `public/countries.geojson` (scaricato automaticamente dalla repo `datasets/geo-countries`)
- `label` — numero/percentuale/data in HUD top-strip (max 4s, non sovrapposto ai sottotitoli)
- `era` — data/anno gigante al centro (es. `28 FEB 2026`), fit-to-width, ~2.5s

### Dossier `src/facts.json`

File di input per `map-script` e `map-plan`. Deve contenere timeline di eventi con date, geografia (coordinate di choke points, terminali, rotte, hub consumatori), numeri chiave e la "verità nascosta" (payoff del video). Esempio: il file committato è quello usato per "guerra Iran → gas Europa". Per un nuovo topic, sostituisci contenuto mantenendo la stessa shape.

### Anti-collisione sottotitoli

Nel `MapVideo` c'è una zona safe (`y = 40%–62%` schermo) sotto cui non possono finire label/pin/route-label: vengono pushati sopra o sotto. I primi 10s evitano anche la fascia banner. Label e highlight si auto-fadano dopo rispettivamente 4s e 6s per evitare accumulo.

### Chromium WebGL

MapLibre richiede WebGL. Remotion è configurato con `swangle` (SwiftShader via ANGLE) in `remotion.config.ts` e nella CLI di render (`--gl=swangle`), necessario su macOS headless.

## Struttura

```
scripts/
  make.mjs         # orchestratore
  script.mjs       # DeepSeek → voice-over + hook banner
  tts.mjs          # ElevenLabs
  download.mjs     # yt-dlp drone (whitelist + URL override)
  prep.mjs         # silence-remove + loudnorm voiceover
  transcribe.mjs   # Whisper word-level
  align.mjs        # Needleman-Wunsch script ↔ whisper tokens
  music.mjs        # loop + loudnorm traccia fissa
  sfx.mjs          # SFX pack + eventi semantici
src/
  MainVideo.tsx    # composition Remotion 1080×1920
  Subtitles.tsx    # word-by-word, highlight giallo
  TopBanner.tsx    # hook banner primi 10 s
  SoundEffects.tsx
```
