// Orchestratore: dato uno slug, esegue normalize + merge-clean + Remotion render.
// Assume che i 6 clip grezzi siano già in nooland-campaign/videos/<slug>/clips/01..06.mp4
// (li mette il browser automation oppure tu manualmente).
//
// Usage: node nooland-campaign/scripts/produce.mjs <slug>
// Esempio: node nooland-campaign/scripts/produce.mjs v13-fuori-sede-A
//
// Output finale: out/<slug>.mp4

import {spawn} from 'node:child_process';
import {readFileSync, existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(ROOT, '..');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node produce.mjs <slug>');
  process.exit(1);
}

const propsPath = path.join(ROOT, 'videos', slug, 'props.json');
if (!existsSync(propsPath)) {
  console.error(`MANCA ${propsPath}`);
  process.exit(1);
}

const props = JSON.parse(readFileSync(propsPath, 'utf8'));
console.log(`[produce] ${slug}`);

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, {stdio: 'inherit', cwd: opts.cwd ?? PROJECT_ROOT, ...opts});
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function main() {
  // 1. Normalize
  await run('bash', [path.join(ROOT, 'scripts/01-normalize.sh'), slug]);

  // 2. Merge clean (no overlay)
  await run('bash', [path.join(ROOT, 'scripts/02-merge-clean.sh'), slug]);

  // 3. Verifica che clean.mp4 esista
  const cleanPath = path.join(PROJECT_ROOT, 'public/nooland-campaign', slug, 'clean.mp4');
  if (!existsSync(cleanPath)) {
    throw new Error(`MANCA ${cleanPath} dopo il merge`);
  }

  // 4. Render Remotion con props inline
  const outDir = path.join(ROOT, 'out');
  mkdirSync(outDir, {recursive: true});
  const finalOut = path.join(outDir, `${slug}.mp4`);

  // Remotion CLI accetta --props come JSON stringificato
  const propsJson = JSON.stringify(props);
  await run('npx', [
    'remotion',
    'render',
    'MetaAiAd',
    finalOut,
    `--props=${propsJson}`,
  ]);

  console.log(`\n✓ DONE → ${finalOut}`);
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
