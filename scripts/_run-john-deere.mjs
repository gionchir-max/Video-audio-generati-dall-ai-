import {fetchClipsForVideo} from './_fetch-clips.mjs';

const QUERIES = [
  'antique blacksmith forge hammering historical',
  'pioneer farming Illinois prairie 1800s historical',
  'old wooden cabin family pioneer 19th century',
  'vintage horse plow farming sepia',
  'industrial revolution factory steam smoke 1800s',
  'farmer working soil sunset cinematic',
  'modern John Deere tractor field aerial',
  'autonomous tractor agriculture technology',
  'wheat harvest combine field aerial',
  'Mississippi river steamboat historical',
];

const total = await fetchClipsForVideo({
  slug: 'john-deere',
  queries: QUERIES,
  totalClips: 33,
  clipDuration: 5.5,
});
console.log(`\n✓ Generati ${total} clip in videos/john-deere/clips/`);
