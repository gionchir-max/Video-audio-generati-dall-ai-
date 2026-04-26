#!/usr/bin/env node
/**
 * init-video <slug> <"Titolo banner">
 *   Crea lo scaffold per un nuovo video:
 *     videos/<slug>/
 *       story.txt    (vuoto, ci scrivi la storia)
 *       meta.json    (config con voce edge-tts e banner pre-compilati)
 *       clips/       (cartella vuota dove mettere 01.mp4..NN.mp4 da meta.ai)
 *
 * Uso: npm run video:init <slug> "TITOLO BANNER"
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const slug = process.argv[2];
const banner = process.argv[3] ?? 'TITOLO DEL VIDEO';
if (!slug) {
  console.error('Usage: npm run video:init <slug> "TITOLO BANNER"');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error('✗ slug solo lowercase, numeri, trattini (es. "greene-seduzione")');
  process.exit(1);
}

const VIDEO_DIR = path.join(ROOT, 'videos', slug);
if (existsSync(VIDEO_DIR)) {
  console.error(`✗ ${VIDEO_DIR} esiste già`);
  process.exit(1);
}

mkdirSync(path.join(VIDEO_DIR, 'clips'), {recursive: true});

writeFileSync(
  path.join(VIDEO_DIR, 'story.txt'),
  '# Scrivi qui il VO. Italiano. Paragrafi separati da riga vuota.\n' +
    "# Edge-tts farà ~2.5 caratteri/secondo, quindi 500 char ≈ 30s di video.\n\n",
);

writeFileSync(
  path.join(VIDEO_DIR, 'meta.json'),
  JSON.stringify(
    {
      banner,
      bannerSeconds: 10,
      voice: 'it-IT-GiuseppeMultilingualNeural',
      rate: '+7%',
      music: 'music.mp3',
      musicVolume: 0.15,
    },
    null,
    2,
  ) + '\n',
);

console.log(`✓ Creato ${path.relative(ROOT, VIDEO_DIR)}/`);
console.log(`  - story.txt   ← scrivi il VO qui`);
console.log(`  - meta.json   ← banner & voce (modificabili)`);
console.log(`  - clips/      ← metti qui 01.mp4 02.mp4 ... (da meta.ai)`);
console.log(`\nQuando pronto:  npm run video ${slug}`);
