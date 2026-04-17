import 'dotenv/config';
import {spawn} from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run make -- "<topic o città>" [--force] [--skip-render]');
  process.exit(1);
}

const force = args.includes('--force');
const skipRender = args.includes('--skip-render');
const positive = args.includes('--positive');
const urlArg = args.find((a) => a.startsWith('--url='));
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

  // 1. Genera script
  await step('script', 'node', ['scripts/script.mjs', topic, ...passForce, ...passPositive]);

  // 2. TTS
  await step('tts', 'node', ['scripts/tts.mjs', ...passForce]);

  // 3. Prep voiceover (silence remove + loudnorm + meta)
  await step('prep', 'node', ['scripts/prep.mjs']);

  // 4. Download video drone (usa voiceoverDuration da meta.json)
  const downloadArgs = ['scripts/download.mjs', topic, ...passForce];
  if (urlArg) downloadArgs.push(urlArg);
  await step('download', 'node', downloadArgs);

  // 5. Re-prep per aggiornare videoDuration in meta.json
  await step('prep (refresh)', 'node', ['scripts/prep.mjs']);

  // 6. Transcribe
  await step('transcribe', 'node', ['scripts/transcribe.mjs']);

  // 7. Align
  await step('align', 'node', ['scripts/align.mjs']);

  // 8. Music
  await step('music', 'node', ['scripts/music.mjs', topic, ...passForce]);

  // 9. SFX
  await step('sfx', 'node', ['scripts/sfx.mjs']);

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
