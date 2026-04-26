import 'dotenv/config';
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const variant = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
const skipRender = args.includes('--skip-render');
const skipTts = args.includes('--skip-tts');
const skipDownload = args.includes('--skip-download');

if (!variant) {
  console.error('Usage: node scripts/adv.mjs <variant> [--force] [--skip-render] [--skip-tts] [--skip-download]');
  process.exit(1);
}

const variantFile = path.join('adv-scripts', `${variant}.json`);
if (!existsSync(variantFile)) {
  console.error(`${variantFile} non trovato`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(variantFile, 'utf8'));

for (const k of ['slug', 'topic', 'voiceover', 'bannerText', 'montageQuery']) {
  if (!cfg[k]) {
    console.error(`[adv] variant "${variant}" manca il campo "${k}"`);
    process.exit(1);
  }
}

function step(name, cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    console.log(`\n━━━ [${name}] ━━━`);
    const p = spawn(cmd, cmdArgs, {stdio: 'inherit'});
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`[${name}] exit ${code}`))));
  });
}

function writeJson(file, obj) {
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, JSON.stringify(obj, null, 2));
}

async function main() {
  const t0 = Date.now();

  // 1. Scrivi script.txt + script.meta.json (bypassa script.mjs LLM)
  writeFileSync('src/script.txt', cfg.voiceover.trim() + '\n');
  writeJson('out/script.meta.json', {
    topic: cfg.topic,
    slug: cfg.slug,
    factsHash: '',
    adv: true,
    variant,
  });
  writeJson('src/banner.json', {text: cfg.bannerText});
  writeJson('src/open-loop.json', {question: '', questionAnchor: '', answerAnchor: '', start: 0, end: 0});
  writeJson('src/sfx.json', [
    {file: 'impact.mp3', atSeconds: 0, volume: 0.55},
    {file: 'whoosh.mp3', atSeconds: 0.15, volume: 0.4},
  ]);
  writeJson('src/cta.json', {
    enabled: true,
    phone: '375 870 7282',
    site: 'nooland.it',
    durationSeconds: 5.5,
  });

  // 2. TTS
  if (!skipTts) {
    await step('tts', 'node', ['scripts/tts.mjs', ...(force ? ['--force'] : [])]);
  }

  // 3. Prep (silence remove + loudnorm + meta)
  await step('prep', 'node', ['scripts/prep.mjs']);

  // 4. Download montage
  if (!skipDownload) {
    const dlArgs = [
      'scripts/download.mjs',
      cfg.topic,
      `--montage=${cfg.montageQuery}`,
      `--montage-clips=${cfg.montageClips || 5}`,
    ];
    if (force) dlArgs.push('--force');
    await step('download', 'node', dlArgs);
  }

  // 5. Re-prep per aggiornare videoDuration
  await step('prep (refresh)', 'node', ['scripts/prep.mjs']);

  // 6. Transcribe (whisper per sottotitoli)
  await step('transcribe', 'node', ['scripts/transcribe.mjs']);

  // 7. Align (words.json per Subtitles.tsx)
  await step('align', 'node', ['scripts/align.mjs']);

  // 8. Music (colonna cinematografica + noMusic flag in meta)
  const meta = JSON.parse(readFileSync('src/meta.json', 'utf8'));
  meta.adv = true;
  if (cfg.noMusic) {
    meta.noMusic = true;
    writeFileSync('src/meta.json', JSON.stringify(meta, null, 2));
    console.log('\n━━━ [music] ━━━');
    console.log('[music] saltato (variant.noMusic=true)');
  } else {
    delete meta.noMusic;
    writeFileSync('src/meta.json', JSON.stringify(meta, null, 2));
    await step('music', 'node', ['scripts/music.mjs', cfg.topic]);
  }

  // 9. SFX (scarica i file audio per whoosh/impact se mancanti)
  await step('sfx', 'node', ['scripts/sfx.mjs']);

  // 10. Render
  if (!skipRender) {
    const outFile = path.join('out', `adv-${variant}.mp4`);
    await step('render', 'npx', ['remotion', 'render', 'MainVideo', outFile, '--codec=h264']);
    console.log(`\n✓ fatto in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${outFile}`);
  } else {
    console.log('\n✓ pipeline completata (render saltato).');
  }
}

main().catch((e) => {
  console.error(`\n✗ pipeline ADV interrotta: ${e.message}`);
  process.exit(1);
});
