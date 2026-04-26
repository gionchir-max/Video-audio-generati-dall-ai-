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

## Configurazione `videos/<slug>/meta.json`

```json
{
  "banner": "TITOLO BANNER",
  "bannerSeconds": 10,
  "voice": "it-IT-GiuseppeMultilingualNeural",
  "rate": "+7%",
  "music": "music.mp3",
  "musicVolume": 0.15
}
```

| chiave | default | note |
|---|---|---|
| `banner` | `"TITOLO"` | Testo del box bianco mostrato in alto nei primi `bannerSeconds`. Uppercase consigliato. |
| `bannerSeconds` | `10` | Durata banner in secondi. Fade-out negli ultimi 0.4s. |
| `voice` | `it-IT-GiuseppeMultilingualNeural` | Voce edge-tts. Altre IT: `it-IT-DiegoNeural`, `it-IT-IsabellaNeural`, `it-IT-ElsaNeural`. |
| `rate` | `+7%` | Velocità edge-tts. Negativo per più lento (es. `-10%`). |
| `music` | `music.mp3` | Musica in `public/`. Metti `null` per nessuna musica. |
| `musicVolume` | `0.15` | 0.0 – 1.0. |

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
