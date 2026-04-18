import 'dotenv/config';
import {spawn} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run make -- "<topic>" [--force] [--skip-render] [--positive] [--url=<yt>] [--montage="<query>"] [--montage-clips=N] [--facts="<fatti freschi post-cutoff LLM>"]');
  process.exit(1);
}

const force = args.includes('--force');
const skipRender = args.includes('--skip-render');
const positive = args.includes('--positive');
const urlArg = args.find((a) => a.startsWith('--url='));
const montageArg = args.find((a) => a.startsWith('--montage='));
const montageClipsArg = args.find((a) => a.startsWith('--montage-clips='));
const factsArg = args.find((a) => a.startsWith('--facts='));
const topic = args.filter((a) => !a.startsWith('--')).join(' ');

function step(name, cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    console.log(`\n━━━ [${name}] ━━━`);
    const p = spawn(cmd, cmdArgs, {stdio: 'inherit'});
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`[${name}] exit ${code}`))));
  });
}

const passForce = force ? ['--force'] : [];
const passPositive = positive ? ['--positive'] : [];

async function main() {
  const t0 = Date.now();

  // 1. Genera script (opzionale --facts= per topic post-cutoff LLM)
  const scriptArgs = ['scripts/script.mjs', topic, ...passForce, ...passPositive];
  if (factsArg) scriptArgs.push(factsArg);
  await step('script', 'node', scriptArgs);

  // 2. TTS
  await step('tts', 'node', ['scripts/tts.mjs', ...passForce]);

  // 3. Prep voiceover (silence remove + loudnorm + meta)
  await step('prep', 'node', ['scripts/prep.mjs']);

  // 4. Download video di sfondo (drone, URL override, o montage multi-clip)
  const downloadArgs = ['scripts/download.mjs', topic, ...passForce];
  if (urlArg) downloadArgs.push(urlArg);
  if (montageArg) downloadArgs.push(montageArg);
  if (montageClipsArg) downloadArgs.push(montageClipsArg);
  await step('download', 'node', downloadArgs);

  // 5. Re-prep per aggiornare videoDuration in meta.json
  await step('prep (refresh)', 'node', ['scripts/prep.mjs']);

  // 6. Transcribe
  await step('transcribe', 'node', ['scripts/transcribe.mjs']);

  // 7. Align
  await step('align', 'node', ['scripts/align.mjs']);

  // 7.5. Extract open-loop question + answer anchor timings (overlay a schermo)
  await step('open-loop', 'node', ['scripts/open-loop.mjs', ...passForce]);

  // 8. Music
  await step('music', 'node', ['scripts/music.mjs', topic, ...passForce]);

  // 9. SFX
  await step('sfx', 'node', ['scripts/sfx.mjs']);

  // 9.5. Sanity check: verifica che public/voiceover.mp3 corrisponda ancora a questo topic
  // (un run concorrente potrebbe averlo sovrascritto dopo il prep). Se mismatch, ripristina da cache.
  try {
    const meta = JSON.parse(readFileSync('out/script.meta.json', 'utf8'));
    const expectedSlug = meta.slug || '';
    const cleanSlugPath = 'public/voiceover.mp3.slug';
    const currentSlug = existsSync(cleanSlugPath) ? readFileSync(cleanSlugPath, 'utf8').trim() : '';
    if (expectedSlug && currentSlug !== expectedSlug) {
      const cached = `cache/voice/${expectedSlug}.mp3`;
      if (existsSync(cached)) {
        copyFileSync(cached, 'public/voiceover.mp3');
        writeFileSync(cleanSlugPath, expectedSlug);
        console.log(`\n[sync] public/voiceover.mp3 era "${currentSlug || '?'}", ripristino da cache/voice/${expectedSlug}.mp3 prima del render`);
      } else {
        throw new Error(`voiceover.mp3 appartiene a "${currentSlug}" ma questo run è "${expectedSlug}" e cache/voice/${expectedSlug}.mp3 non esiste`);
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  // 10. Render
  if (!skipRender) {
    const outFile = path.join('out', `${topic.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`);
    await step('render', 'npx', ['remotion', 'render', 'MainVideo', outFile, '--codec=h264']);
    console.log(`\n✓ fatto in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${outFile}`);
  } else {
    console.log(`\n✓ pipeline completa (render saltato). Apri lo studio con \`npm run studio\``);
  }
}

main().catch((e) => {
  console.error(`\n✗ pipeline interrotta: ${e.message}`);
  process.exit(1);
});
