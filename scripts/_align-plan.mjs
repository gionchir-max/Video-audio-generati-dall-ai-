#!/usr/bin/env node
/**
 * _align-plan.mjs <slug>
 *
 * Pipeline allineamento clip-VO. Input richiesto:
 *   - videos/<slug>/audio/voiceover.mp3   (genera con `node scripts/make-video.mjs <slug>` step1)
 *   - videos/<slug>/prompts.md           (con N prompt iniziali, 1 per frase)
 *
 * Output:
 *   - videos/<slug>/sentence-timings.json   {N: {start, end, dur}}
 *   - videos/<slug>/clip-plan.json          {N: {n_clips, target_per_clip, clip_files[]}}
 *   - videos/<slug>/prompts.md              aggiornato con prompt B-roll (numerati a partire da N+1)
 *
 * Workflow next:
 *   - Aggiorna runner _run-<slug>.mjs con TOTAL_CLIPS = (max clip_files)
 *   - Lancia runner per generare clip mancanti
 *   - `npm run video <slug>` → step2 concat aligned (no stretch, no freeze)
 */
import {readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

import ffmpegStatic from 'ffmpeg-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/_align-plan.mjs <slug>');
  process.exit(1);
}

const VIDEO_DIR = path.join(ROOT, 'videos', slug);
const VO_PATH = path.join(VIDEO_DIR, 'audio', 'voiceover.mp3');
const PROMPTS_PATH = path.join(VIDEO_DIR, 'prompts.md');
const TIMINGS_PATH = path.join(VIDEO_DIR, 'sentence-timings.json');
const PLAN_PATH = path.join(VIDEO_DIR, 'clip-plan.json');
const WHISPER_BIN = path.join(ROOT, 'whisper.cpp', 'main');
const WHISPER_MODEL = path.join(ROOT, 'whisper.cpp', 'models', 'ggml-medium.bin');

if (!existsSync(VO_PATH)) {
  console.error(`✗ Manca ${VO_PATH}`);
  console.error(`  Lancia prima: node scripts/make-video.mjs ${slug}  (genererà il VO)`);
  process.exit(1);
}
if (!existsSync(PROMPTS_PATH)) { console.error(`✗ Manca ${PROMPTS_PATH}`); process.exit(1); }
if (!existsSync(WHISPER_BIN)) { console.error(`✗ Manca ${WHISPER_BIN}`); process.exit(1); }
if (!existsSync(WHISPER_MODEL)) { console.error(`✗ Manca ${WHISPER_MODEL}\n  Scarica con: cd whisper.cpp && bash models/download-ggml-model.sh medium`); process.exit(1); }

// Soglia: frase più lunga di questa (s) richiede 2 clip
const CLIP_NATIVE = 5.21;
const TWO_CLIP_THRESHOLD = 5.6;
const THREE_CLIP_THRESHOLD = 2 * CLIP_NATIVE;  // ~10.4s

console.log(`▶ align-plan ${slug}`);

// 1. Estrai prompts (numero, frase, prompt) da prompts.md
const md = readFileSync(PROMPTS_PATH, 'utf8');
const promptRe = /\*\*(\d{2,3})\*\* — _"([^"]+)"_\n>\s*([^\n]+)/g;
const prompts = {};
let m;
while ((m = promptRe.exec(md)) !== null) {
  prompts[parseInt(m[1], 10)] = {text: m[2], full: m[3].trim()};
}
const promptIds = Object.keys(prompts).map(Number).sort((a, b) => a - b);
const N = promptIds.length;
console.log(`  Frasi nel prompts.md: ${N}`);

// 2. Converti VO in WAV 16kHz mono per whisper
const TMP_WAV = path.join(os.tmpdir(), `${slug}-vo.wav`);
const TMP_JSON_PFX = path.join(os.tmpdir(), `${slug}-vo`);
console.log(`  [1/4] convert VO → wav 16khz`);
const r1 = spawnSync(ffmpegStatic, [
  '-y', '-i', VO_PATH, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', TMP_WAV
]);
if (r1.status !== 0) { console.error('ffmpeg failed:', r1.stderr.toString()); process.exit(1); }

// 3. Esegui whisper.cpp con output JSON
console.log(`  [2/4] whisper transcribe (medium, italian)`);
const r2 = spawnSync(WHISPER_BIN, [
  '-m', WHISPER_MODEL, '-f', TMP_WAV, '-l', 'it',
  '--output-json', '--output-file', TMP_JSON_PFX, '-t', '8',
], {stdio: ['ignore', 'ignore', 'ignore']});
const TMP_JSON = TMP_JSON_PFX + '.json';
if (r2.status !== 0 || !existsSync(TMP_JSON)) {
  console.error('whisper failed'); process.exit(1);
}
const whisperData = JSON.parse(readFileSync(TMP_JSON, 'utf8'));
const segments = whisperData.transcription || [];
console.log(`    whisper segmenti: ${segments.length}`);

// 4. Costruisci word-level timeline da segmenti whisper (distribuzione lineare nel segmento)
function norm(s) {
  return s.toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const words = [];
for (const seg of segments) {
  const txt = norm(seg.text);
  if (!txt) continue;
  const ws = txt.split(' ').filter(Boolean);
  if (!ws.length) continue;
  const s = seg.offsets.from / 1000.0;
  const e = seg.offsets.to / 1000.0;
  const dt = (e - s) / ws.length;
  for (let i = 0; i < ws.length; i++) {
    words.push({w: ws[i], s: s + i * dt, e: s + (i + 1) * dt});
  }
}

// 5. Match ogni frase prompts.md → window in words
function findWindow(target, allWords, startIdx, maxOffset = 30) {
  const n = target.length;
  let best = null, bestScore = -1;
  for (const wLen of [n, n - 1, n + 1, n - 2, n + 2, n - 3, n + 3]) {
    if (wLen < 1) continue;
    for (let off = 0; off < Math.min(maxOffset, allWords.length - startIdx - wLen + 1); off++) {
      const sIdx = startIdx + off, eIdx = sIdx + wLen;
      if (eIdx > allWords.length) break;
      const window = [];
      for (let i = sIdx; i < eIdx; i++) window.push(allWords[i].w);
      let matches = 0;
      for (const t of target) if (window.includes(t)) matches++;
      const score = matches / Math.max(n, wLen);
      if (score > bestScore) { bestScore = score; best = [sIdx, eIdx, score]; }
      if (score === 1.0) return best;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

console.log(`  [3/4] match frasi → timestamps`);
let cursor = 0;
const timings = {};
const unmapped = [];
for (const id of promptIds) {
  const tgt = norm(prompts[id].text).split(' ').filter(Boolean);
  const r = findWindow(tgt, words, cursor, 30);
  if (r) {
    const [sIdx, eIdx] = r;
    timings[id] = {
      start: +words[sIdx].s.toFixed(3),
      end: +words[eIdx - 1].e.toFixed(3),
      dur: +(words[eIdx - 1].e - words[sIdx].s).toFixed(3),
    };
    cursor = eIdx;
  } else {
    unmapped.push(id);
  }
}
// Distribuisci proporzionalmente le non matchate
if (unmapped.length) {
  const matched = Object.keys(timings).map(Number).sort((a, b) => a - b);
  const lastMatched = matched[matched.length - 1];
  const lastEnd = lastMatched != null ? timings[lastMatched].end : 0;
  const voTotal = words.length ? words[words.length - 1].e : 180;
  const span = voTotal - lastEnd;
  const totalUnmappedWords = unmapped.reduce((s, n) => s + norm(prompts[n].text).split(' ').filter(Boolean).length, 0);
  let curT = lastEnd;
  for (const id of unmapped) {
    const w = norm(prompts[id].text).split(' ').filter(Boolean).length;
    const d = totalUnmappedWords > 0 ? (w / totalUnmappedWords) * span : 3.0;
    timings[id] = {start: +curT.toFixed(3), end: +(curT + d).toFixed(3), dur: +d.toFixed(3)};
    curT += d;
  }
}
writeFileSync(TIMINGS_PATH, JSON.stringify(timings, null, 2));
console.log(`    sentence-timings.json salvato (${Object.keys(timings).length} frasi)`);

// 6. Compute clip-plan
const plan = {};
for (const id of promptIds) {
  const t = timings[id];
  let nClips;
  if (t.dur <= TWO_CLIP_THRESHOLD) nClips = 1;
  else if (t.dur <= THREE_CLIP_THRESHOLD) nClips = 2;
  else nClips = 3;
  plan[id] = {
    ...t,
    n_clips: nClips,
    target_per_clip: +(t.dur / nClips).toFixed(3),
    clip_files: [id], // primo è l'esistente
  };
}

// 7. Append B-roll prompts a prompts.md
const transforms = [
  [/slow push-in extreme close-up/i, 'wide establishing shot'],
  [/slow push-in close-up/i, 'pull-back medium shot'],
  [/extreme close-up/i, 'medium tracking shot'],
  [/close-up/i, 'wide shot'],
  [/medium tracking shot/i, 'low-angle detail shot'],
  [/medium two-shot/i, 'over-the-shoulder shot'],
  [/medium close-up/i, 'wide aerial shot'],
  [/medium shot/i, 'tilt-down detail shot'],
  [/wide shot/i, 'medium close-up'],
  [/sweeping aerial drone shot/i, 'ground-level tracking shot'],
  [/aerial drone shot/i, 'side-angle low shot'],
  [/aerial wide shot/i, 'eye-level medium close-up'],
  [/low-angle medium/i, 'high-angle medium'],
  [/high-angle wide/i, 'eye-level medium'],
  [/slow push-in/i, 'orbit'],
  [/slow tilt-up/i, 'slow tilt-down'],
  [/slow tilt-down/i, 'slow tilt-up'],
  [/slow tracking/i, 'reverse-tracking'],
  [/dynamic medium/i, 'static intimate close-up'],
  [/dynamic tracking/i, 'static low-angle'],
  [/dynamic low-angle tracking/i, 'overhead aerial tracking'],
];
function makeBroll(orig) {
  for (const [src, dst] of transforms) {
    if (src.test(orig)) return orig.replace(src, dst);
  }
  return orig.replace(/(5-second cinematic video clip:\s*hyper-saturated colors,\s*)/i, '$1alternative angle ');
}

let nextClipNum = Math.max(...promptIds) + 1;
const brollLines = [];
brollLines.push('\n---\n\n## Clip B-roll allineamento (auto-generato)\n');
brollLines.push(`\nB-roll/cutaway delle frasi più lunghe (>${TWO_CLIP_THRESHOLD}s).\n`);
brollLines.push(`Mappatura frase→clip in \`clip-plan.json\`.\n\n`);

let appended = 0;
for (const id of promptIds) {
  const p = plan[id];
  if (p.n_clips === 1) continue;
  // Aggiungi N-1 cliip extra
  for (let extra = 1; extra < p.n_clips; extra++) {
    const broll = makeBroll(prompts[id].full);
    brollLines.push(`**${String(nextClipNum).padStart(3, '0')}** — _"${prompts[id].text}"_  (B-roll #${extra} per frase ${id})\n`);
    brollLines.push(`> ${broll}\n\n`);
    p.clip_files.push(nextClipNum);
    nextClipNum++;
    appended++;
  }
}

// Salva clip-plan
writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2));
console.log(`    clip-plan.json salvato (${Object.keys(plan).length} frasi → ${nextClipNum - 1} clip totali)`);

// Append B-roll a prompts.md (prima di "## Note operative")
let newMd = md;
if (appended > 0) {
  // Rimuovi sezione B-roll precedente se esiste
  newMd = newMd.replace(/\n---\n\n## Clip B-roll allineamento.*?(?=\n## Note operative|\n## Pipeline|$)/s, '\n');
  // Inietta nuova sezione prima di "## Note operative meta.ai" o fine file
  const noteIdx = newMd.indexOf('## Note operative');
  if (noteIdx >= 0) {
    newMd = newMd.slice(0, noteIdx) + brollLines.join('') + newMd.slice(noteIdx);
  } else {
    newMd += brollLines.join('');
  }
  writeFileSync(PROMPTS_PATH, newMd);
}

console.log(`  [4/4] B-roll prompts append: ${appended}`);
console.log(`\n✓ DONE`);
console.log(`  • ${Object.keys(plan).length} frasi mappate`);
console.log(`  • ${nextClipNum - 1} clip totali necessarie (${appended} B-roll extra)`);
console.log(`  • Aggiorna runner: TOTAL_CLIPS = ${nextClipNum - 1}`);
console.log(`  • Poi: node scripts/_run-${slug}.mjs`);

try { unlinkSync(TMP_WAV); } catch {}
try { unlinkSync(TMP_JSON); } catch {}
