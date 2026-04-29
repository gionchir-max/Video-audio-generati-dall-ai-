#!/usr/bin/env node
// Auto-mode: genera N clip colapesce su meta.ai via CDP
// VO durata: 230.06s → 47 clip

import {chromium} from 'playwright';
import {readFileSync, writeFileSync, existsSync, statSync, mkdirSync, appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const SLUG = "colapesce";
const TOTAL_CLIPS = 47;
const CDP_URL = 'http://localhost:50041';
const ROOT = '/Volumes/Extreme SSD/Video Claude/tiktok-city';
const PROMPTS_FILE = `${ROOT}/videos/${SLUG}/prompts.md`;
const OUT_DIR = `${ROOT}/videos/${SLUG}/clips`;
const LOG_FILE = `${ROOT}/videos/${SLUG}/run.log`;
const STATE_FILE = `${ROOT}/videos/${SLUG}/state.json`;

mkdirSync(OUT_DIR, {recursive: true});

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function loadState() {
  if (existsSync(STATE_FILE)) {
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    s.skipped = s.skipped || [];
    return s;
  }
  return {downloaded: [], skipped: [], chatUuid: null, clipsInCurrentChat: 0};
}
function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function parsePrompts() {
  const text = readFileSync(PROMPTS_FILE, 'utf8');
  const re = /\*\*(\d{2})\*\*[^\n]*\n>\s*([^\n]+)/g;
  const prompts = {};
  let m;
  while ((m = re.exec(text)) !== null) prompts[parseInt(m[1], 10)] = m[2].trim();
  return prompts;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function activateCreaVideo(page) {
  log('  → click "Crea video"');
  const ok = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button'));
    const cv = all.find(b => /^crea video$/i.test(b.innerText.trim()));
    if (!cv) return false;
    cv.click();
    return true;
  });
  if (!ok) throw new Error('Bottone "Crea video" non trovato');
  await sleep(2000);
}

async function getVideoSrcsInChat(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('video'))
      .map(v => v.src || v.querySelector('source')?.src || '')
      .filter(s => s && s.startsWith('http'))
  );
}

async function sendPrompt(page, prompt) {
  log('  → invio prompt:', prompt.slice(0, 80) + '...');
  await page.evaluate((text) => {
    const tb = document.querySelector('div[contenteditable="true"]');
    if (!tb) throw new Error('textbox non trovato');
    tb.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, text);
  }, prompt);
  await sleep(1500);
  for (let i = 0; i < 30; i++) {
    const enabled = await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="Invia"]');
      return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
    });
    if (enabled) break;
    await sleep(1000);
  }
  await page.evaluate(() => document.querySelector('button[aria-label="Invia"]').click());
  log('  → prompt inviato');
}

async function detectRefusal(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    return ["i can't generate", "i can't create", 'too specific for my current guidelines',
            "doesn't meet our content guidelines", "i'm not able to generate",
            'violates our content policies', 'oops!'].some(p => text.includes(p));
  });
}

async function waitForNewVideos(page, beforeSrcs, expectedNew = 4, timeoutMs = 240000) {
  const start = Date.now();
  let lastNew = 0;
  while (Date.now() - start < timeoutMs) {
    const current = await getVideoSrcsInChat(page);
    const newOnes = current.filter(s => !beforeSrcs.includes(s));
    if (newOnes.length !== lastNew) {
      log(`    [wait] ${newOnes.length}/${expectedNew} nuovi video`);
      lastNew = newOnes.length;
    }
    if (newOnes.length >= expectedNew) return {videos: newOnes, refused: false};
    if (await detectRefusal(page)) {
      log('    [REFUSAL] meta.ai ha rifiutato il prompt');
      return {videos: [], refused: true};
    }
    await sleep(5000);
  }
  const final = await getVideoSrcsInChat(page);
  return {videos: final.filter(s => !beforeSrcs.includes(s)), refused: false};
}

function downloadVideo(url, outPath) {
  log(`    [curl] → ${path.basename(outPath)}`);
  const r = spawnSync('curl', ['-sS', '-L', '--max-time', '90', '-o', outPath, url]);
  if (r.status !== 0 || !existsSync(outPath)) {
    log(`    [curl] FAIL status=${r.status}`);
    return false;
  }
  const sz = statSync(outPath).size;
  if (sz < 200000) { log(`    [curl] FAIL size: ${sz}B`); return false; }
  log(`    [curl] OK ${(sz/1024).toFixed(0)}KB`);
  return true;
}

async function openNewChatVideoMode(page) {
  log('FASE: nuova chat in modalità video');
  await page.goto('https://www.meta.ai/', {waitUntil: 'domcontentloaded'});
  await sleep(3000);
  await activateCreaVideo(page);
}

async function main() {
  const prompts = parsePrompts();
  const promptCount = Object.keys(prompts).length;
  log(`Parsed ${promptCount} prompts`);
  if (promptCount < TOTAL_CLIPS) throw new Error(`Expected ${TOTAL_CLIPS} prompts, got ${promptCount}`);

  const state = loadState();
  log(`State: downloaded=${state.downloaded.length}, chatUuid=${state.chatUuid}`);

  log(`Connecting to CDP at ${CDP_URL}...`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();

  for (let clipNum = 1; clipNum <= TOTAL_CLIPS; clipNum++) {
    if (state.downloaded.includes(clipNum)) {
      log(`Clip ${clipNum} già scaricata, skip`);
      continue;
    }
    const prompt = prompts[clipNum];
    if (!prompt) { log(`!! prompt ${clipNum} mancante, skip`); continue; }

    log(`\n=== CLIP ${clipNum} ===`);
    const isNewChat = state.clipsInCurrentChat === 0 || state.clipsInCurrentChat >= 3 || !state.chatUuid;
    if (isNewChat) {
      await openNewChatVideoMode(page);
      state.chatUuid = null;
      state.clipsInCurrentChat = 0;
      saveState(state);
    } else {
      const targetUrl = `https://www.meta.ai/prompt/${state.chatUuid}`;
      if (!page.url().startsWith(targetUrl)) {
        await page.goto(targetUrl, {waitUntil: 'domcontentloaded'});
        await sleep(3000);
      }
    }

    const before = await getVideoSrcsInChat(page);
    log(`  videos prima dell'invio: ${before.length}`);

    try {
      await sendPrompt(page, prompt);
    } catch (e) {
      log(`  ERRORE invio clip ${clipNum}: ${e.message} → segno come skipped`);
      state.skipped.push(clipNum);
      await openNewChatVideoMode(page);
      state.chatUuid = null;
      state.clipsInCurrentChat = 0;
      saveState(state);
      continue;
    }

    if (isNewChat) {
      for (let i = 0; i < 15; i++) {
        await sleep(2000);
        if (page.url().includes('/prompt/')) {
          const m = page.url().match(/\/prompt\/([0-9a-f-]+)/i);
          if (m) { state.chatUuid = m[1]; log(`  → chat creata: ${state.chatUuid}`); }
          break;
        }
      }
    }

    const result = await waitForNewVideos(page, before, 4, 240000);
    if (result.refused) {
      log(`  [SKIP] Clip ${clipNum} rifiutata da meta.ai`);
      state.skipped.push(clipNum);
      await openNewChatVideoMode(page);
      state.chatUuid = null;
      state.clipsInCurrentChat = 0;
      saveState(state);
      continue;
    }
    if (result.videos.length === 0) {
      log(`  TIMEOUT clip ${clipNum}`);
      state.skipped.push(clipNum);
      saveState(state);
      continue;
    }
    log(`  trovati ${result.videos.length} nuovi video, scarico SOLO il primo`);
    const outPath = path.join(OUT_DIR, String(clipNum).padStart(2, '0') + '.mp4');
    if (downloadVideo(result.videos[0], outPath)) {
      state.downloaded.push(clipNum);
      state.clipsInCurrentChat++;
      saveState(state);
    } else {
      state.skipped.push(clipNum);
      saveState(state);
    }
    await sleep(2000);
  }

  log(`\nCOMPLETATO. Downloaded: ${state.downloaded.length}/${TOTAL_CLIPS}, Skipped: ${state.skipped.length}`);
  if (state.skipped.length > 0) log(`Skipped: ${state.skipped.join(', ')}`);
  await browser.close();
}

main().catch(e => { log('FATAL:', e.message, e.stack); process.exit(1); });
