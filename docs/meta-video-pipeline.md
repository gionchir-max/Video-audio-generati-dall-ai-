# Meta.ai → Remotion: pipeline video TikTok 1080×1920

Playbook end-to-end per generare un video TikTok 9:16 da una storia, usando:
- **meta.ai** (browser automation via CDP) per le clip 5s
- **edge-tts** per il voiceover italiano
- **Remotion** per il render finale con banner + musica

Errori comuni e relativi fix sono codificati nelle 9 regole sotto. **Leggere prima di scrivere prompts**.

---

## 1. Forzare modalità video (no immagini)

`meta.ai` ha due modi: "Crea immagine" e "Crea video". Senza attivazione esplicita cade in image mode e genera PNG.

**Regole tassative:**
1. Lo script deve cliccare il bottone `Crea video` sulla home PRIMA di ogni nuova chat
2. Ogni prompt INIZIA con: `5-second cinematic video clip:`
3. Includere ≥1 verbo di movimento (camera/soggetto): `camera tracks/pushes/orbits`, `walks/turns/raises`, `smoke rises`, `wind blows`

Senza queste 3 condizioni: meta.ai produce immagini statiche con `nb_frames=125` ma file identici (stessa size esatta). Sintomo: `md5` di tutte le clip uguale.

## 2. Selettore video corretto

❌ NON usare `main video` o navigare a `/create/<id>` — quella pagina mostra una galleria di TUTTI i video creati dall'account, non il singolo.

✅ Estrarre i video direttamente dalla chat `/prompt/<uuid>`:

```js
// Snapshot prima dell'invio
const before = await page.evaluate(() =>
  Array.from(document.querySelectorAll('video'))
    .map(v => v.src).filter(s => s.startsWith('http'))
);
await sendPrompt(page, prompt);
// Wait for 4 nuovi src
const news = current.filter(s => !before.includes(s));
// Scarica news[0] (prima variante delle 4)
```

## 3. Colori saturi e accesi

I video meta.ai default sono "naturalistic". Per look TikTok punchy includere SEMPRE:
- `vivid saturated colors` oppure `vibrant punchy colors`
- Descrittori cromatici espliciti: `deep blue sky`, `vibrant amber foliage`, `brilliant orange sparks`, `lush emerald grass`

## 4. Linguaggio neutro per evitare moderation

Risposta di rifiuto: `Oops! I can't generate that video. The scene might be too specific for my current guidelines.`

**Triggers identificati** (verificati 2026-04-26 progetto john-deere):

| Trigger | Sostituzione sicura |
|---|---|
| `wife` + `baby` + `children` | `pioneer family on the prairie` |
| `failure`, `debt collectors` | omettere; usare `weary` o `tired` |
| `John Deere blacksmith Vermont 1837` | `bearded artisan in 19th century setting` |
| `tight close-up of eyes + blade` | `medium close-up of face lighting up` |
| Luoghi storici reali specifici | `prairie`, `19th century countryside` |

## 5. Gestione rifiuti nello script

```js
async function detectRefusal(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    return ["i can't generate", "i can't create", "too specific for my current guidelines",
            "doesn't meet our content guidelines", "oops!"].some(p => text.includes(p));
  });
}
```

Quando rilevato:
- **NON ritentare lo stesso prompt** (verrà rifiutato di nuovo)
- Marca clip in `state.skipped[]`
- Apri nuova chat (reset state)
- Continua con prompt successivo
- A fine batch, riformula a mano i prompt skipped e lancia un mini-script per quelli

## 6. Voce TTS: NO multilingual

`it-IT-GiuseppeMultilingualNeural` riconosce parole anglosassoni e le pronuncia con accento inglese mid-sentence. L'utente percepisce "suoni incomprensibili" sui nomi propri (Vermont, Mississippi, Moline).

**Voci raccomandate** (non-multilingual, italianizzano tutto):
- `it-IT-DiegoNeural` (maschile)
- `it-IT-IsabellaNeural` (femminile)

**Calibrazione rate**:
| Voce | Rate consigliato | Note |
|---|---|---|
| Giuseppe Multilingual | `+7%` | baseline ma sconsigliato per i bug |
| Diego | `+18%` | naturale è ~13% più lento di Giuseppe |
| Isabella | `+15%` | femminile, più calda |

## 7. Story.txt: niente parole inglesi residue

Anche le voci non-multilingual pronunciano in inglese le parole anglosassoni inserite nel testo italiano. Esempi visti:

❌ `L'acciaio polished taglia il suolo`
✅ `L'acciaio lucido taglia il suolo`

❌ `Il business partner gli dice...`
✅ `Il socio in affari gli dice...`

**Tollerati**: nomi propri inglesi (John Deere, Boston, Mississippi) con voce non-multilingual che li italianizza.

## 8. bg.mp4 deve essere ≥ VO

`make-video.mjs` taglia il finale se `bg.mp4 < voiceover.mp3`. Avviso visibile a fine render:

```
⚠  bg.mp4 (171.6s) è più corto del VO (182.0s).
   Aggiungi più clip in clips/ per coprire tutto il VO.
```

**Calcolo numero clip**:
- Ogni clip meta.ai = 5.21s reali (5208ms a 24fps)
- `N = ceil(VO_seconds / 5) + 2` (2 di margine)
- Esempio: VO 186s → N=39 minimo, ma 36 va bene se la clip 36 dura 5.21s e clip totali = 187.5s

## 9. Workflow per un nuovo video

```bash
# 1. Setup cartella
mkdir -p videos/<slug>/{clips,audio,out}
cp templates/meta.json videos/<slug>/meta.json

# 2. Scrivi story.txt (italiano puro)
$EDITOR videos/<slug>/story.txt

# 3. Stima durata VO
edge-tts --voice it-IT-DiegoNeural --rate "+18%" \
  --text "$(cat videos/<slug>/story.txt)" \
  --write-media /tmp/vo-test.mp3
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 /tmp/vo-test.mp3
# es: 186.3 → ceil(186.3/5)+2 = 39 clip

# 4. Scrivi prompts.md con 39 prompt seguendo regole 1-4
# Template in fondo

# 5. Adatta scripts/_run-<slug>.mjs (slug + numero clip)
# Lancia
nohup node scripts/_run-<slug>.mjs > videos/<slug>/run.log 2>&1 &

# 6. Verifica clip integri (post generazione)
for f in videos/<slug>/clips/*.mp4; do
  size=$(stat -f%z "$f")
  [ $size -lt 200000 ] && echo "SMALL: $f"
done
# Hash check duplicati
md5 videos/<slug>/clips/*.mp4 | sort -k2 | uniq -d -f1

# 7. Render finale
npm run video <slug>
# Verifica nessun warning "bg.mp4 più corto del VO"
```

---

## Template meta.json

```json
{
  "banner": "TITOLO IN MAIUSCOLO",
  "bannerSeconds": 10,
  "voice": "it-IT-DiegoNeural",
  "rate": "+18%",
  "music": "music.mp3",
  "musicVolume": 0.15
}
```

## Template prompts.md (esempio)

```markdown
# <slug> — prompts clip meta.ai

**Stile globale**: vivid saturated colors, vibrant punchy color grading,
photorealistic cinematic, Canon EOS R5, 9:16 vertical, no text

## Hook

**01** — _"<frase 1 del VO>"_
> 5-second cinematic video clip: vivid saturated colors, <wide/medium/close-up>,
> camera <tracks/pushes/orbits>, <soggetto neutro> <verbo movimento>,
> <descrittori cromatici>, photorealistic cinematic, Canon EOS R5, 9:16 vertical
```
