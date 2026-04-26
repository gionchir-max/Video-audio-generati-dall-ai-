import 'dotenv/config';
import {writeFileSync, mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error('Set FAL_KEY in .env');

const STYLE =
  'cinematic photography, anamorphic 35mm film look, Kodak Portra 400 grain, muted cinematic palette of warm ambers and cool teals, shallow depth of field, soft natural rim light, vertical 9:16 composition, strong foreground subject, photorealistic, no text, no watermark';

const BEATS = [
  {
    id: 1,
    image:
      'Extreme close-up of an old crumpled 100-dollar bill torn in half on a dark wooden table, a single out-of-focus candle flame in the background casting golden reflections on the torn edge, visible micro-grain texture on paper, dramatic chiaroscuro',
    motion: 'slow push-in 10 percent toward the tear, candle flame gently dancing, subtle dust particles in the light',
  },
  {
    id: 2,
    image:
      'Close-up of masculine hands rotating a vintage Rubik cube on a wooden desk covered with scattered silver coins and autumn leaves, warm side-window light, cube colors mismatched and messy, shallow depth of field',
    motion: 'slight cube rotation by the hands, a few coins sliding slowly away, warm light flicker',
  },
];

async function falSubmit(model, input) {
  const res = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: {Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`fal submit ${model}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function falPoll(sub, label) {
  const start = Date.now();
  while (true) {
    const s = await fetch(sub.status_url, {headers: {Authorization: `Key ${FAL_KEY}`}});
    if (!s.ok) throw new Error(`fal status: ${s.status} ${await s.text()}`);
    const j = await s.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    if (j.status === 'COMPLETED') {
      const r = await fetch(sub.response_url, {headers: {Authorization: `Key ${FAL_KEY}`}});
      if (!r.ok) throw new Error(`fal response: ${r.status} ${await r.text()}`);
      return r.json();
    }
    if (j.status === 'FAILED' || j.status === 'ERROR') {
      throw new Error(`fal failed: ${JSON.stringify(j)}`);
    }
    process.stdout.write(`\r  [${label}] ${j.status} · ${elapsed}s   `);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function genImage(prompt, beatId) {
  const fullPrompt = `${prompt}. ${STYLE}`;
  console.log(`\n[beat ${beatId}] nano-banana image...`);
  const sub = await falSubmit('fal-ai/nano-banana', {
    prompt: fullPrompt,
    num_images: 1,
    aspect_ratio: '9:16',
    output_format: 'jpeg',
  });
  const result = await falPoll(sub, 'nano-banana');
  console.log();
  return result.images[0].url;
}

async function animate(imageUrl, motionPrompt, beatId) {
  console.log(`[beat ${beatId}] seedance-pro 5s...`);
  const sub = await falSubmit('fal-ai/bytedance/seedance/v1/pro/image-to-video', {
    prompt: motionPrompt,
    image_url: imageUrl,
    duration: '5',
    resolution: '1080p',
    aspect_ratio: '9:16',
  });
  const result = await falPoll(sub, 'seedance-pro');
  console.log();
  return result.video.url;
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, {stdio: 'inherit'});
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exit ${c}`))));
  });
}

async function main() {
  const OUT = 'out/ai-preview';
  mkdirSync(OUT, {recursive: true});

  const clips = [];
  for (const beat of BEATS) {
    const imgPath = path.join(OUT, `beat-${beat.id}.jpg`);
    const clipPath = path.join(OUT, `beat-${beat.id}.mp4`);

    const imgUrl = await genImage(beat.image, beat.id);
    await download(imgUrl, imgPath);
    console.log(`  ✓ image → ${imgPath}`);

    const videoUrl = await animate(imgUrl, beat.motion, beat.id);
    await download(videoUrl, clipPath);
    console.log(`  ✓ clip  → ${clipPath}`);

    clips.push(clipPath);
  }

  const listPath = path.join(OUT, 'list.txt');
  writeFileSync(
    listPath,
    clips.map((c) => `file '${path.resolve(c)}'`).join('\n') + '\n',
  );
  const finalOut = 'out/ai-preview.mp4';
  console.log('\n[concat] ffmpeg...');
  await ffmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-an',
    finalOut,
  ]);
  console.log(`\n✓ preview → ${finalOut}`);
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
