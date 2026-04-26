import {readFileSync, writeFileSync} from 'node:fs';

const path = 'src/map-plan.json';
const plan = JSON.parse(readFileSync(path, 'utf8'));

// Zoom target per keyword nella description
function pickZoom(desc) {
  const d = (desc || '').toLowerCase();
  if (/mondo|spazio|europa|continent/.test(d)) return 4.2;
  if (/panoramic|nord italia|sud italia|penisola/.test(d)) return 5.5;
  if (/rotta|mille|spedizione|marcia|transizione|dominio|domini/.test(d)) return 5.8;
  if (/regno|stato|granducato|ducato|lombardo|pontificio|sicilie/.test(d)) return 6.5;
  if (/milano|napoli|torino|firenze|palermo|vienna|parigi|roma|genova|modena|parma|venez|marsiglia|teano|marsala|caprera|bologna|quarto|plombi/.test(d)) return 9.5;
  if (/battaglia|solferino|magenta|custoza|volturno|calatafimi|messina|milazzo|porta pia|breccia/.test(d)) return 10.5;
  if (/cavour muore|mazzini|garibaldi.*caprera|4 uomini|verita|2[,.]5%|plebiscito|brigantaggio/.test(d)) return 6.0;
  if (/chiusura|sintesi/.test(d)) return 5.0;
  return 6.0;
}

function pickPitch(desc, zoom) {
  const d = (desc || '').toLowerCase();
  if (/spazio|mondo|europa|panoramic/.test(d)) return 0;
  if (/battaglia|breccia|porta pia|solferino|massacro|fuga|morte|muore/.test(d)) return 55;
  if (zoom >= 9) return 45;
  if (zoom >= 7) return 35;
  return 20;
}

for (let i = 0; i < plan.scenes.length; i++) {
  const s = plan.scenes[i];
  // Skip prima scena (apertura già ben dimensionata: 2 → 8)
  if (i === 0) continue;

  const cam = s.camera;
  const desc = s.description || '';
  const targetZoom = pickZoom(desc);
  const targetPitch = pickPitch(desc, targetZoom);

  const cs = cam.start, ce = cam.end;

  // Se zoom sballati (< 2 o > 14), riassegna
  if (!Number.isFinite(cs.zoom) || cs.zoom < 2 || cs.zoom > 14) cs.zoom = targetZoom;
  if (!Number.isFinite(ce.zoom) || ce.zoom < 2 || ce.zoom > 14) ce.zoom = targetZoom;

  // Aggiungi push-in se start==end → zoom drammatico dentro la scena
  if (Math.abs(cs.zoom - ce.zoom) < 0.1) {
    // push-in: start più largo, end più stretto
    cs.zoom = Math.max(2, targetZoom - 1.2);
    ce.zoom = Math.min(14, targetZoom + 0.6);
  }

  // Pitch: start flat, end drammatico, per dare effetto tilt
  if (!Number.isFinite(cs.pitch)) cs.pitch = 0;
  if (!Number.isFinite(ce.pitch)) ce.pitch = targetPitch;
  if (cs.pitch === ce.pitch) {
    cs.pitch = Math.max(0, targetPitch - 20);
    ce.pitch = targetPitch;
  }

  // Bearing: leggera rotazione cinematografica (0 → ±8°)
  if (!Number.isFinite(cs.bearing)) cs.bearing = 0;
  if (!Number.isFinite(ce.bearing)) ce.bearing = 0;
  if (cs.bearing === ce.bearing) {
    const dir = i % 2 === 0 ? 1 : -1;
    ce.bearing = cs.bearing + dir * 6;
  }

  // Se center start==end (scena "statica") aggiungi microparallasse (0.3° lng)
  if (cs.center[0] === ce.center[0] && cs.center[1] === ce.center[1]) {
    ce.center = [ce.center[0] + 0.25, ce.center[1] - 0.1];
  }
}

// Fix startTime/endTime della prima scena (era 0 → -1)
if (plan.scenes[0].endTime <= plan.scenes[0].startTime) {
  plan.scenes[0].endTime = plan.scenes[1]?.startTime || 5;
}

writeFileSync(path, JSON.stringify(plan, null, 2));
console.log('✓ map-plan.json patched');
for (const s of plan.scenes) {
  const a = s.camera.start, b = s.camera.end;
  console.log(`  ${s.startTime.toFixed(1)}-${s.endTime.toFixed(1)}s z:${a.zoom.toFixed(1)}→${b.zoom.toFixed(1)} p:${a.pitch}→${b.pitch} | ${s.description?.slice(0, 60)}`);
}
