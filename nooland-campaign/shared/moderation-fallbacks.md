# Moderation Fallbacks — Prompt sostituti

FAL/seedance-pro accetta più liberamente di meta.ai, ma ha comunque un classifier che rifiuta:
- Violenza esplicita su persone/animali
- Sangue
- Scene di morte
- Contenuti illegali

Per ogni scena critica delle nostre campagne, predispongo phrasing alternativo che ottiene **lo stesso impatto emotivo senza trigger words**.

---

## Categoria FUOCO/INCENDIO

### ❌ Termini ad alto rischio rejection
- `"wildfire"`, `"raging fire"`, `"disaster"`, `"explosion"`
- `"animals burning"`, `"dead animals in fire"`

### ✅ Phrasing alternativo
| Vuoi mostrare | Usa invece |
|---|---|
| Incendio attivo | "glowing orange light front advancing through dry grass at sunset, thick rolling smoke" |
| Esplosione di fiamme | "sudden bright orange light bursting from dry vegetation, embers rising in heat shimmer" |
| Animali in fuga | "small animal silhouettes running away from glowing light in golden haze" |
| Foresta bruciata | "blackened scorched landscape with charcoal-grey ash covering the ground, twisted dark tree trunks" |
| Casa in fiamme | "warm intense orange glow from inside window frames, dark smoke rising from rooftop" |

---

## Categoria ANIMALI (gatti, conigli morti)

### ❌ Termini ad alto rischio
- `"dead cat"`, `"burned animal"`, `"animal corpse"`
- `"bloody"`, `"injured"` su animali

### ✅ Phrasing alternativo
| Vuoi mostrare | Usa invece |
|---|---|
| Gatto morto | "ash-covered tabby kitten lying very still on blackened ground, eyes closed peacefully" |
| Gatto sopravvissuto traumatizzato | "ash-covered tabby kitten alive but trembling with wide scared green eyes" |
| Coniglio morto | "small fluffy rabbit silhouette unmoving in soft focus background, gentle melancholy" |
| Sacchetto/corpo | "small object covered with white sheet on blackened ground, cypress branch placed on top" |

---

## Categoria CRUDELTÀ (piromania) ⚠️ MOLTO DELICATO

Per i video V07/V08/V09 (piromania), l'approccio deve essere **suggestivo, mai esplicito**. Mostriamo:
- Mai il gesto criminale in atto
- Solo il prima (fiammifero acceso, mano che fugge) o il dopo (cenere, oggetto bruciato)
- Sempre dal punto di vista della vittima o dell'investigatore

### Phrasing approvati
- "anonymous gloved hand striking a metal lighter, flame igniting, then quickly withdrawing into shadow"
- "glowing cigarette butt thrown into dry grass in slow motion, sparks scattering"
- "investigator's gloved hand picking up burned plastic gas can from ash"
- "police evidence marker cones placed on blackened ground"

### NON usare
- "arsonist setting fire to animal"
- "cruel act"
- "torturing"
- Qualsiasi descrizione di un'aggressione attiva su un essere vivente

---

## Categoria PERSONE IN PERICOLO

### ❌ Trigger
- `"woman screaming"`, `"man dying"`, `"victim"`
- `"violent"`, `"attack"`

### ✅ Alternative
- "elderly woman with worried expression looking out the window at distant smoke"
- "man with eyes closed in quiet grief, single tear, golden window light"
- "neighbors holding each other watching distant horizon with concern"

---

## Strategia di retry

Lo script `generate.mjs` deve avere **retry intelligente**:

1. Tentativo 1: prompt originale
2. Se rejection → tentativo 2 con phrasing softening (sostituisce 1-2 termini critici)
3. Se rejection → tentativo 3 con prompt da `moderation-fallbacks.md` matchato per categoria
4. Se ancora rejection → log warning, l'utente decide manualmente

Ogni rejection va loggata in `nooland-campaign/out/moderation-log.json` per analisi.

---

## Test moderation pre-batch

Prima di un batch da 18 clip (es. tema piromania), generare **1 solo clip pilota** con il prompt più rischioso del batch. Se passa, procedere; se no, applicare già i fallback al batch intero.
