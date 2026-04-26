import {readFileSync, writeFileSync} from 'node:fs';

const path = 'src/map-plan.json';
const plan = JSON.parse(readFileSync(path, 'utf8'));

// MapTiler style slugs validi:
// satellite, hybrid (satellite-hybrid), streets-v2, streets-v2-dark,
// basic-v2, bright-v2, outdoor-v2, toner-v2, topo-v2, winter-v2, pastel
function pickStyle(desc, i, total) {
  const d = (desc || '').toLowerCase();
  // Apertura / chiusura / sintesi → satellite epic
  if (i === 0 || i >= total - 3) return 'satellite-hybrid';
  // Negoziato Plombières / accordo segreto / verità nascosta → toner B&W drammatico
  if (/plombi|accordo|verita|2[,.]5%|nascost/.test(d)) return 'toner-v2';
  // Morti / massacro / lutto → toner
  if (/muore|morte|massacro|fucil|brigant/.test(d)) return 'toner-v2';
  // Battaglie terrestri → satellite (terreno reale)
  if (/solferino|magenta|calatafimi|custoza|volturno|milazzo|battaglia/.test(d)) return 'satellite';
  // Porta Pia / Breccia / caduta Stato Pontificio → streets-v2-dark
  if (/porta pia|breccia|pontificio|caduta/.test(d)) return 'streets-v2-dark';
  // Rotta Mille / mare / sbarco / Quarto / Marsala / Sicilia / Messina → satellite-hybrid
  if (/mille|spedizione|rotta|mare|sbarco|quarto|marsala|sicilia|messina|caprera/.test(d)) return 'satellite-hybrid';
  // Impero Austria / Vienna / dominio → streets-v2-dark
  if (/vienna|austria|impero|domini|dominio|asburg/.test(d)) return 'streets-v2-dark';
  // Stati preunitari / politica / granducato / regno / frammentazione → basic-v2
  if (/stato|stati|regno|granducato|ducato|lombardo|pontificio|borbon/.test(d)) return 'basic-v2';
  // Città capitali / proclamazione / incontro → streets-v2
  if (/torino|napoli|firenze|roma capitale|palermo|proclamaz|teano|incontro|parigi|marsiglia/.test(d)) return 'streets-v2';
  // Guerre / invasioni / panoramica nord → basic-v2
  if (/guerra|invade|invasion|armistizio|cession|plebiscito/.test(d)) return 'basic-v2';
  // Cavour / Mazzini / personaggi → streets-v2
  if (/cavour|mazzini|garibaldi|vittorio emanuele|quattro uomini/.test(d)) return 'streets-v2';
  // Transizioni / intro → basic-v2
  if (/transizion|introduz|domanda|conclus|sintesi/.test(d)) return 'basic-v2';
  return 'satellite-hybrid';
}

const total = plan.scenes.length;
for (let i = 0; i < total; i++) {
  const s = plan.scenes[i];
  const style = pickStyle(s.description, i, total);
  s.style = style;
}
plan.style = 'satellite-hybrid'; // fallback globale

writeFileSync(path, JSON.stringify(plan, null, 2));
const counts = {};
for (const s of plan.scenes) counts[s.style] = (counts[s.style] || 0) + 1;
console.log('✓ stili assegnati per scena:');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v} scene`);
console.log('\ndettaglio:');
for (const s of plan.scenes) {
  console.log(`  [${s.style.padEnd(18)}] ${s.startTime.toFixed(1)}-${s.endTime.toFixed(1)}s ${s.description?.slice(0, 60)}`);
}
