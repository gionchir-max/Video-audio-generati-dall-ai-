# Setup MCP browser per Claude Code

Hai scelto di installare un MCP browser così Claude Code può davvero pilotare il tuo Chrome e generare i 108 clip su meta.ai automaticamente. Servono ~15 minuti.

---

## Opzione consigliata: Playwright MCP (Microsoft, ufficiale)

Robusto, ben mantenuto, supporta profilo Chrome persistente (così resti loggato su meta.ai), può scaricare file.

### Installazione

Apri un nuovo terminale e lancia:

```bash
claude mcp add playwright -- npx '@playwright/mcp@latest' --browser chrome --user-data-dir "$HOME/.claude/playwright-profile"
```

Cosa fa:
- Registra `playwright` come MCP server in Claude Code
- Usa Chrome (non Chromium) — quello che hai già installato sul Mac
- `--user-data-dir` salva i cookie/login in una cartella separata (non tocca il tuo profilo Chrome principale)
- La prima volta che usi meta.ai dovrai loggarti, dopo resterà loggato

### Verifica

Dopo l'installazione, in Claude Code lancia:

```
/mcp
```

Dovresti vedere `playwright` nella lista degli MCP server attivi. Se non lo vedi, riavvia Claude Code.

---

## Alternativa: Chrome DevTools MCP (Google)

Se Playwright dà problemi:

```bash
claude mcp add chrome-devtools -- npx 'chrome-devtools-mcp@latest'
```

Più leggero ma meno robusto su task come download file.

---

## Cosa fare dopo l'installazione

1. **Riavvia Claude Code** (chiudi e riapri questa finestra) per far caricare l'MCP.
2. **Apri questa stessa cartella di lavoro**: `/Volumes/Extreme SSD/Video Claude/tiktok-city/`
3. **Scrivi**: *"riprendi la campagna Nooland, ho installato playwright MCP"*
4. Io aprirò Chrome via MCP, navigherò su meta.ai, ti chiederò UNA volta di loggarti, e da lì genererò il video pilota V13 (6 clip) come test.
5. Se il pilota funziona, procedo con gli altri 17 video.

---

## Pre-flight check (opzionale)

Prima di riavviare Claude, verifica che:

- [ ] Hai un account Meta funzionante con accesso a meta.ai
- [ ] meta.ai è disponibile dal tuo paese (alcuni paesi UE hanno restrizioni per Movie Gen)
- [ ] Hai almeno 5GB liberi su disco (servono per i 108 clip totali, ~30MB ciascuno)

---

## Stato attuale del progetto

Tutta l'infrastruttura **a valle** della generazione clip è già pronta:

- `nooland-campaign/shared/*` — character bible, style, geo, moderation fallbacks, INDEX completo dei 18 video
- `nooland-campaign/videos/v13-fuori-sede-A/` — pilota completo (prompts.md, props.json)
- `nooland-campaign/scripts/01-normalize.sh` + `02-merge-clean.sh` + `produce.mjs` — pipeline ffmpeg + Remotion
- `src/MetaAiAd.tsx` — composition Remotion parametrica, registrata in `Root.tsx`
- `package.json` script `npm run produce <slug>` per pipeline completa post-clip

Manca solo: **i 6 clip mp4 in `nooland-campaign/videos/v13-fuori-sede-A/clips/01..06.mp4`**.
Quelli li genera il browser automation appena attivato l'MCP.

---

## In caso di problemi

Se Playwright non funziona o meta.ai non genera video pubblicamente:

- **Fallback A**: passiamo a generazione manuale assistita (io ti scrivo i prompt batch, tu copi/incolli — file `prompts.md` per V13 è già pronto).
- **Fallback B**: passiamo a FAL API (~$70 per tutti i 18 video, totalmente automatico, lo script `scripts/fire-story.mjs` è già 80% adattabile).

Dimmi quale preferisci se incontri ostacoli.
