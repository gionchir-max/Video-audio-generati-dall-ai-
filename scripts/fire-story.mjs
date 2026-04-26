import 'dotenv/config';
import {writeFileSync, mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error('Set FAL_KEY in .env');

// Disney/Pixar hyper-saturated 3D animation style bible.
const STYLE =
  '3D Pixar Disney animation style, hyper-saturated vibrant colors, polished CGI, dramatic cinematic lighting, golden hour rim light, stylized character design with expressive faces, subsurface scattering skin, soft global illumination, shallow depth of field, vertical 9:16 composition, frame from a Pixar theatrical short, emotional storytelling, ultra-detailed textures, no text, no watermark, no captions';

// Recurring character — locked description so it stays consistent.
const MAN =
  'a rugged Italian man in his early 40s, weathered sun-tanned face, short dark brown hair with gray temples, stubble beard, olive-green work jacket over a beige shirt, worn dark jeans, sturdy brown leather boots, warm hazel eyes';

const GRANDPA =
  'an elderly Italian grandfather, thick white mustache, kind wrinkled face, flat cap, brown wool vest, rolled-up white shirt';

const BEATS = [
  {
    id: 1,
    title: 'LA MEMORIA',
    image: `Wide cinematic shot of ${MAN} standing in silence on an abandoned plot of dry land, tall straw-colored grass waving around him, ochre earth cracked by drought, distant Tuscan hills sun-bleached under a deep azure sky, his back slightly turned, hands in pockets, melancholy expression; above his head a soft cartoon thought-bubble cloud reveals the same land as it was: perfectly aligned rows of emerald olive trees, vivid green grass, golden sunlight, and inside the memory himself as a 7-year-old boy holding hands with ${GRANDPA}, both beaming with joy, warm nostalgic atmosphere`,
    motion:
      'very slow push-in toward the man, grass sways in the warm breeze, the thought bubble gently pulses and the memory inside the cloud animates softly — the young boy and grandfather smile and squeeze hands, light particles drift',
  },
  {
    id: 2,
    title: "L'ERRORE",
    image: `Extreme close-up three-quarter shot of ${MAN}, pulling a red cigarette pack from his jacket pocket, tapping one out, lighter flaring a bright orange flame illuminating his face, a curl of blue smoke drifting; in the soft-focus foreground the dry straw-colored grass and cracked ochre earth; his expression is indifferent, slightly annoyed; saturated sunset sky behind him in amber and magenta`,
    motion:
      'he flicks the lighter, flame ignites vividly, he takes one deep drag, cheeks hollow, exhales a curl of blue smoke, then flicks the glowing cigarette butt into the dry grass — the butt tumbles in slow arc, sparks fly, no one notices',
  },
  {
    id: 3,
    title: 'IL DISASTRO',
    image: `Epic wide shot of a raging wildfire: vivid orange and crimson flames explode from the dry grass and race across the field, thick black smoke billows into a red-tinged sky, high-voltage power lines along the edge of the land sag, snap, and rain sparks onto the roof of a neighboring stone farmhouse that has just caught fire; terrified villagers in colorful clothes flee in the foreground, a brown dog and frightened deer bolt through the flames, embers float like glowing fireflies`,
    motion:
      'flames surge rapidly forward, power lines snap with a burst of electric-blue sparks and fall, fire leaps onto the farmhouse roof igniting it, people and animals sprint across the frame in panic, smoke billows upward, ember particles swirl',
  },
  {
    id: 4,
    title: 'LE CONSEGUENZE',
    image: `Cinematic shot of the front porch of a modest Italian countryside home at dusk, warm interior light spilling through the doorway as ${MAN} opens his door looking guilty and pale; on the threshold two Carabinieri officers in dark uniforms with red-striped trousers and peaked caps stand stern, one holding a clipboard; in the upper background a bright red firefighting helicopter with a dangling water bucket flies low over the still-smoking blackened field, orange embers glowing on the horizon, dramatic teal-and-orange dusk sky`,
    motion:
      'the door swings open, man flinches, officers exchange a glance, the helicopter rotor visibly spins as it banks across the sky over the smoldering land, light flashes from its underbelly, smoke drifts',
  },
  {
    id: 5,
    title: 'IL TRIBUNALE',
    image: `Dramatic low-angle shot inside an ornate Italian courtroom, tall dark-wood paneling, deep red velvet curtains, gleaming brass fixtures, a stern judge in black robes with white jabot raising a polished wooden gavel high above the bench; on the paper verbale document in front of him, bold clearly legible handwritten text reads "RESPONSABILITÀ PENALE" in dark ink with an official red stamp; ${MAN} stands in the foreground sideways, shoulders slumped, head bowed; warm amber sunbeams pour through tall arched windows illuminating floating dust particles`,
    motion:
      'the judge slams the gavel down with force, a burst of dust rises from the bench, the stamped document vibrates slightly, the man lowers his head further, sunbeams shimmer',
  },
  {
    id: 6,
    title: 'IL RIMPIANTO',
    image: `Emotional wide shot of a quiet Italian hillside cemetery at sunset, rows of pale marble headstones, tall dark cypress trees silhouetted against a saturated magenta-and-gold sky; ${MAN} kneels alone at the foot of his grandfather's grave, placing a small bouquet of white daisies and yellow wildflowers on the stone; a single tear runs down his cheek, his other hand rests on the headstone which is engraved with "NONNO"; a warm golden shaft of light breaks through the cypress, dust motes glow, the burned field visible far behind in the valley`,
    motion:
      'he sets the flowers down gently, one tear slides slowly down his cheek, his lips tremble, light breeze moves the cypress branches, a single white petal drifts to the ground, golden light slowly fades',
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
  const OUT = 'out/fire-story';
  mkdirSync(OUT, {recursive: true});

  const clips = [];
  for (const beat of BEATS) {
    const imgPath = path.join(OUT, `beat-${beat.id}.jpg`);
    const clipPath = path.join(OUT, `beat-${beat.id}.mp4`);

    console.log(`\n═══ BEAT ${beat.id} — ${beat.title} ═══`);
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
  const finalOut = 'out/fire-story.mp4';
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
  console.log(`\n✓ final → ${finalOut}`);
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
