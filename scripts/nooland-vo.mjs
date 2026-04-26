import 'dotenv/config';
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const FAL_KEY = process.env.FAL_KEY;
if (!API_KEY || !VOICE_ID) throw new Error('ELEVENLABS_API_KEY / VOICE_ID mancanti in .env');
if (!FAL_KEY) throw new Error('FAL_KEY mancante in .env');

const OUT_DIR = 'out/nooland';
const SRC_BEATS = 'out/fire-story';
mkdirSync(OUT_DIR, {recursive: true});

const VO_OUT = path.join(OUT_DIR, 'vo.mp3');
const FINAL_OUT = 'out/fire-story-nooland.mp4';

// ~30s VO — ritmo sul montaggio 6×5s.
const VO_TEXT =
  `Il tuo terreno abbandonato... è l'eredità della tua famiglia.\n\n` +
  `Ma se lo lasci andare, basta una scintilla.\n\n` +
  `Un incendio divora la tua terra, la tua storia.\n\n` +
  `Bussano alla porta. Le forze dell'ordine.\n\n` +
  `Tribunale. Responsabilità penale. Per una semplice distrazione.\n\n` +
  `Con Nooland pulisci il tuo terreno in modo facile, veloce ed economico. Zero stress.\n\n` +
  `Nooland. Il tuo terreno, protetto.`;

// SFX prompt per ogni beat (5s) — dati a mmaudio-v2 come hint.
const SFX_PROMPTS = [
  /* 1 */ 'soft summer wind through tall dry grass, distant birds chirping, peaceful rural ambience',
  /* 2 */ 'metallic lighter flick, flame ignite, soft cigarette exhale, subtle ember crackle',
  /* 3 */ 'massive wildfire roaring and crackling, electrical sparks, distant panicked crowd, animals fleeing, cinematic disaster',
  /* 4 */ 'three firm door knocks, helicopter rotor passing overhead, evening ambience',
  /* 5 */ 'wooden judge gavel slammed hard with deep echo, courtroom silence',
  /* 6 */ 'gentle cemetery wind, cypress trees rustling, distant bell, melancholic emotional strings',
];

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, {stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']});
    let err = '';
    if (!opts.inherit) p.stderr?.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exit ${c}: ${err}`))));
  });
}

async function generateVO() {
  if (existsSync(VO_OUT) && statSync(VO_OUT).size > 10000) {
    console.log(`[vo] cache hit → ${VO_OUT}`);
    return;
  }
  console.log(`[vo] ElevenLabs ${MODEL_ID} (${VO_TEXT.length} char)...`);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg'},
      body: JSON.stringify({
        text: VO_TEXT,
        model_id: MODEL_ID,
        voice_settings: {stability: 0.5, similarity_boost: 0.9, style: 0.55, use_speaker_boost: true, speed: 1.0},
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(VO_OUT, buf);
  console.log(`[vo] → ${VO_OUT} (${(buf.length / 1024).toFixed(0)} KB)`);
}

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
    if (j.status === 'FAILED' || j.status === 'ERROR') throw new Error(`fal failed: ${JSON.stringify(j)}`);
    process.stdout.write(`\r  [${label}] ${j.status} · ${elapsed}s   `);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function uploadToFal(filePath) {
  const buf = Buffer.from(readFileSync(filePath));
  // Initiate
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST',
    headers: {Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      content_type: 'video/mp4',
      file_name: path.basename(filePath),
    }),
  });
  if (!init.ok) throw new Error(`fal upload init: ${init.status} ${await init.text()}`);
  const {upload_url, file_url} = await init.json();
  const up = await fetch(upload_url, {method: 'PUT', body: buf, headers: {'Content-Type': 'video/mp4'}});
  if (!up.ok) throw new Error(`fal upload PUT: ${up.status} ${await up.text()}`);
  return file_url;
}

async function generateBeatAudio(beatId, prompt) {
  const beatVideo = path.join(SRC_BEATS, `beat-${beatId}.mp4`);
  const outAudio = path.join(OUT_DIR, `beat-${beatId}.m4a`);
  if (existsSync(outAudio) && statSync(outAudio).size > 5000) {
    console.log(`[sfx ${beatId}] cache hit`);
    return outAudio;
  }
  console.log(`\n[sfx ${beatId}] upload → fal...`);
  const videoUrl = await uploadToFal(beatVideo);
  console.log(`[sfx ${beatId}] mmaudio-v2...`);
  const sub = await falSubmit('fal-ai/mmaudio-v2', {
    video_url: videoUrl,
    prompt,
    num_steps: 25,
    duration: 5,
    cfg_strength: 4.5,
  });
  const result = await falPoll(sub, `mmaudio-${beatId}`);
  console.log();
  // mmaudio returns a video with audio; download and extract audio.
  const videoWithAudio = result.video?.url || result.url;
  if (!videoWithAudio) throw new Error(`mmaudio no video url: ${JSON.stringify(result)}`);
  const tmpMp4 = path.join(OUT_DIR, `beat-${beatId}-audio.mp4`);
  const r = await fetch(videoWithAudio);
  if (!r.ok) throw new Error(`download mmaudio ${r.status}`);
  writeFileSync(tmpMp4, Buffer.from(await r.arrayBuffer()));
  // extract audio
  await run(ffmpegPath, ['-y', '-i', tmpMp4, '-vn', '-c:a', 'aac', '-b:a', '160k', outAudio]);
  console.log(`[sfx ${beatId}] → ${outAudio}`);
  return outAudio;
}

async function main() {
  await generateVO();

  const sfxPaths = [];
  for (let i = 0; i < SFX_PROMPTS.length; i++) {
    sfxPaths.push(await generateBeatAudio(i + 1, SFX_PROMPTS[i]));
  }

  // Mix audio (VO + SFX) + overlay logo Nooland in fade-in negli ultimi 3.5s.
  // Input indices: 0=video, 1=VO, 2=logo, 3..8=SFX
  const LOGO_START = 26.5; // su 30s totali → last 3.5s
  const args = [
    '-y',
    '-i', 'out/fire-story.mp4',
    '-i', VO_OUT,
    '-loop', '1', '-t', '4', '-i', 'public/logo.png',
  ];
  sfxPaths.forEach((p) => args.push('-i', p));

  const filters = [];
  // Logo: scale a 620px, fade-in alpha, overlay centrato
  filters.push(`[2:v]format=rgba,scale=620:-1,fade=t=in:st=0:d=0.7:alpha=1,setpts=PTS-STARTPTS+${LOGO_START}/TB[lg]`);
  filters.push(`[0:v][lg]overlay=x=(W-w)/2:y=(H-h)/2-120:enable='between(t,${LOGO_START},30)':format=auto[v]`);
  // Audio
  filters.push(`[1:a]volume=1.2[vo]`);
  sfxPaths.forEach((_, i) => {
    const delay = i * 5000;
    filters.push(`[${3 + i}:a]volume=0.5,adelay=${delay}|${delay},apad[s${i + 1}]`);
  });
  const labels = ['[vo]', ...sfxPaths.map((_, i) => `[s${i + 1}]`)].join('');
  filters.push(`${labels}amix=inputs=${1 + sfxPaths.length}:duration=first:normalize=0,alimiter=limit=0.95[aout]`);

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[v]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-t', '30',
    FINAL_OUT,
  );

  console.log('\n[mux] ffmpeg…');
  await run(ffmpegPath, args, {inherit: true});
  console.log(`\n✓ final → ${FINAL_OUT}`);
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
