import 'dotenv/config';
import {spawn} from 'node:child_process';
import {existsSync, statSync, mkdirSync, createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';

const COUNTRIES_PATH = path.join('public', 'countries.geojson');
const COUNTRIES_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

async function ensureCountries() {
  if (existsSync(COUNTRIES_PATH) && statSync(COUNTRIES_PATH).size > 1_000_000) return;
  mkdirSync('public', {recursive: true});
  console.log(`[setup] scarico ${COUNTRIES_PATH} da geo-countries...`);
  const res = await fetch(COUNTRIES_URL);
  if (!res.ok) throw new Error(`download countries fallito: ${res.status}`);
  await pipeline(res.body, createWriteStream(COUNTRIES_PATH));
  console.log(`[setup] OK → ${COUNTRIES_PATH} (${(statSync(COUNTRIES_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run make-map -- "<topic>" [--force] [--skip-render]');
  process.exit(1);
}

const force = args.includes('--force');
const skipRender = args.includes('--skip-render');
const topic = args.filter((a) => !a.startsWith('--')).join(' ');

const passForce = force ? ['--force'] : [];

function step(name, cmd, cmdArgs, extraEnv) {
  return new Promise((resolve, reject) => {
    console.log(`\n━━━ [${name}] ━━━`);
    const env = {...process.env, ...(extraEnv || {})};
    const p = spawn(cmd, cmdArgs, {stdio: 'inherit', env});
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`[${name}] exit ${code}`))));
  });
}

async function main() {
  if (!process.env.MAPTILER_API_KEY) {
    console.error('MAPTILER_API_KEY mancante nel .env');
    process.exit(1);
  }

  await ensureCountries();

  const t0 = Date.now();

  // 1. Genera script geo-aware (usa src/facts.json)
  await step('map-script', 'node', ['scripts/map-script.mjs', topic, ...passForce]);

  // 2. TTS
  await step('tts', 'node', ['scripts/tts.mjs', ...passForce]);

  // 3. Prep voiceover (bg.mp4 non richiesto)
  await step('prep', 'node', ['scripts/prep.mjs']);

  // 4. Transcribe
  await step('transcribe', 'node', ['scripts/transcribe.mjs']);

  // 5. Align
  await step('align', 'node', ['scripts/align.mjs']);

  // 6. Map plan (legge script + words + facts → piano scene). Sempre rigenerato: dipende da script/words.
  await step('map-plan', 'node', ['scripts/map-plan.mjs', '--force']);

  // 7. Music
  await step('music', 'node', ['scripts/music.mjs', topic, ...passForce]);

  // 8. SFX
  await step('sfx', 'node', ['scripts/sfx.mjs']);

  // 9. Render MapVideo composition (passa la key a Remotion via REMOTION_ prefix)
  if (!skipRender) {
    const outFile = path.join('out', `${topic.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`);
    await step(
      'render',
      'npx',
      ['remotion', 'render', 'MapVideo', outFile, '--codec=h264', '--concurrency=1', '--gl=swangle'],
      {REMOTION_MAPTILER_KEY: process.env.MAPTILER_API_KEY},
    );
    console.log(`\n✓ fatto in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${outFile}`);
  } else {
    console.log(`\n✓ pipeline completa (render saltato). Apri lo studio con REMOTION_MAPTILER_KEY=... npm run studio`);
  }
}

main().catch((e) => {
  console.error(`\n✗ pipeline interrotta: ${e.message}`);
  process.exit(1);
});
