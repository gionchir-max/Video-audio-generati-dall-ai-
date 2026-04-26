# Index — 18 Video Nooland Campaign

Mappa completa: video → topic → hook → caratteri → provincia → VO voice.

| Slug | Topic | Hook (caption frame 0) | Personaggi | Provincia | VO | Sprint |
|---|---|---|---|---|---|---|
| `v01-incendio-A` | Incendio+animali | "Sembrava solo un campo." | Gatto, Luca | Caltanissetta | F | 1 |
| `v02-incendio-B` | Incendio+animali | "Il gatto della nonna è scomparso il 3 agosto." | Nonna anziana, Gatto, Luca | Palermo | F | 1 |
| `v03-incendio-C` | Incendio+animali | "150 ettari. 12 ore. Tutto perso." | Operatori VVF, Luca | Agrigento | F | 1 |
| `v04-avi-A` | Rispetto avi | "Mio nonno comprò questo terreno con 40 anni di pesca." | Nonno, Marco (giovane in flashback), Luca | Enna | F | 2 |
| `v05-avi-B` | Rispetto avi | "L'ho vista costruire questo muretto. Pietra per pietra." | Nonno, Gatto, Luca | Ragusa | F | 2 |
| `v06-avi-C` | Rispetto avi | "Ti chiamavi 'capofamiglia' quando non bastava il pane." | Nonno, famiglia anni '50, Luca | Trapani | F | 2 |
| `v07-piromania-A` | Piromania | "Ai piromani serve solo l'erba alta." | Piromane silhouette, Gatto, Luca | Catania | F | 3 |
| `v08-piromania-B` | Piromania | "Hanno trovato il cane legato al palo." | Cane, investigatori, Luca | Messina | F | 3 |
| `v09-piromania-C` | Piromania | "I conigli del vicino. Vivi. Bruciati." | Conigli, anziano contadino, Luca | Siracusa | F | 3 |
| `v10-multa-A` | Multa+penale | "Tribunale di Caltanissetta. 14 luglio." | Marco, giudice, carabinieri, Luca | Caltanissetta | M | 4 |
| `v11-multa-B` | Multa+penale | "Ordinanza comunale. 30 giorni." | Marco, postino con racc, Luca | Agrigento | M | 4 |
| `v12-multa-C` | Multa+penale | "8.000 euro. Per non aver tagliato l'erba." | Marco, calcolatrice, Luca | Siracusa | M | 4 |
| `v13-fuori-sede-A` ★ PILOT | Fuori sede | "Vivo a Milano. Il terreno è a Enna." | Marco, Luca | Enna | M | 5 |
| `v14-fuori-sede-B` | Fuori sede | "Quante volte hai chiamato 'l'amico che ha il trattore'?" | Marco, vari finti operatori, Luca | Ragusa | M | 5 |
| `v15-fuori-sede-C` | Fuori sede | "Foto, GPS, fattura. Tutto sul telefono." | Marco, Luca, mockup app | Messina | M | 5 |
| `v16-trasparenza-A` | Trasparenza+tech | "1972: 200.000 lire e una stretta di mano." | Nonno (1972), Marco (oggi), Luca | Catania | M | 6 |
| `v17-trasparenza-B` | Trasparenza+tech | "Pagamento bloccato finché il lavoro non è fatto." | Marco, dashboard Nooland, Luca | Trapani | M | 6 |
| `v18-trasparenza-C` | Trasparenza+tech | "Niente bot. Una persona vera ti chiama." | Customer care umano, Marco, Luca | Palermo | M | 6 |

---

## Stato produzione (aggiornare manualmente)

| Slug | beats.json | clips/ generati | clean.mp4 | VO TTS | final.mp4 | Note |
|---|---|---|---|---|---|---|
| v13-fuori-sede-A | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | PILOTA — primo da produrre |
| altri 17 | — | — | — | — | — | bloccati finché pilota non approvato |

---

## Costi e tempi (FAL stimati)

- nano-banana ~$0.025/img × 6 = $0.15 / video
- seedance-pro 5s 1080p ~$0.62 / clip × 6 = $3.72 / video
- **Totale per video: ~$3.87**
- **Totale per 18 video: ~$70**
- Tempo: ~10 min generazione + ~2 min pipeline = ~12 min/video → ~3.5 ore per tutti

---

## Audio music library

Suggerite 4 tracce (royalty-free, da scaricare da Pixabay/YouTube Library):

- `dramatic-cinematic.mp3` → V01-V03, V07-V09 (incendio + piromania)
- `elegiac-piano.mp3` → V04-V06 (avi)
- `urgent-pulse.mp3` → V10-V12 (multa)
- `modern-pop-uplift.mp3` → V13-V15, V16-V18 (fuori sede + tech)

Mappatura in ogni `props.json` come `musicTrack: "elegiac-piano.mp3"`.
