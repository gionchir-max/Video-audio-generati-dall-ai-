/**
 * Post-process map-plan.json per:
 *  1. sostituire country=IT con preset stato preunitario appropriato per l'epoca
 *  2. aggiungere timeline anno per scene con date storiche
 *  3. attivare moving marker su route dei Mille / battaglie
 *  4. assegnare stili di mappa appropriati per scena
 *  5. fix zoom/pitch per camera dinamica
 */
import {readFileSync, writeFileSync} from 'node:fs';

const path = 'src/map-plan.json';
const plan = JSON.parse(readFileSync(path, 'utf8'));

// Mappa descrizione scena → preset storico
function pickPreset(desc) {
  const d = (desc || '').toLowerCase();
  if (/due sicilie|borbon|napoli.*borbon|regno.*sicil/.test(d)) return 'due-sicilie';
  if (/pontificio|stato.*papa|roma.*papa|lazio.*papa|chiesa|vaticano/.test(d)) return 'pontificio';
  if (/lombardo.?veneto|austriac[oi].*milano|austriaco.*lombard|veneto.*austr|lombardia austr/.test(d)) return 'lombardo-veneto';
  if (/granducato.*tosc|tosca/.test(d)) return 'toscana';
  if (/ducato.*parma|parma/.test(d)) return 'parma';
  if (/ducato.*modena|modena/.test(d)) return 'modena';
  if (/regno.*sardeg|piemonte|savoia.*regno|torino.*cavour|cavour.*torino/.test(d) && !/cedut/.test(d)) return 'sardegna';
  if (/nizza|savoia.*francia|cedut/.test(d)) return 'nizza-savoia';
  return null;
}

// Timeline anno per scena
function pickYear(desc) {
  const d = (desc || '').toLowerCase();
  const m = d.match(/\b(18[0-7][0-9])\b/);
  if (m) return m[1];
  if (/vienna|congresso/.test(d) && !/1859/.test(d)) return '1815';
  if (/plombi/.test(d)) return '1858';
  if (/magenta|solferino|villafranca/.test(d)) return '1859';
  if (/mille|marsala|calatafimi|palermo|quarto|teano|volturno/.test(d)) return '1860';
  if (/proclamaz.*regno|primo.*re|vittorio emanuele.*re/.test(d)) return '1861';
  if (/cavour.*muor|muor.*cavour/.test(d)) return '1861';
  if (/custoza|terza.*guerra|veneto.*italia|plebiscito/.test(d)) return '1866';
  if (/porta pia|breccia|roma.*capit/.test(d)) return '1870';
  if (/brigant|guerra civil/.test(d)) return '1861-1870';
  return null;
}

// Moving icon per route
function pickRouteIcon(label, desc) {
  const l = ((label || '') + ' ' + (desc || '')).toLowerCase();
  if (/mille|marsala|sbarco|piroscaf|quarto|mare/.test(l)) return '⛵';
  if (/marcia|truppe|garibald|calatafimi|palermo|napoli/.test(l)) return '►';
  if (/bersaglier|porta pia|roma/.test(l)) return '►';
  return '►';
}

// Style per scena (stesso algoritmo di fix-styles.mjs ma inline)
function pickStyle(desc, i, total) {
  const d = (desc || '').toLowerCase();
  if (i === 0 || i >= total - 3) return 'satellite-hybrid';
  if (/plombi|accordo|verita|2[,.]5%|nascost/.test(d)) return 'toner-v2';
  if (/muore|morte|massacro|fucil|brigant/.test(d)) return 'toner-v2';
  if (/solferino|magenta|calatafimi|custoza|volturno|milazzo|battaglia/.test(d)) return 'satellite';
  if (/porta pia|breccia|pontificio|caduta/.test(d)) return 'streets-v2-dark';
  if (/mille|spedizione|rotta|mare|sbarco|quarto|marsala|sicilia|messina|caprera/.test(d)) return 'satellite-hybrid';
  if (/vienna|austria|impero|domini|dominio|asburg/.test(d)) return 'streets-v2-dark';
  if (/stato|stati|regno|granducato|ducato|lombardo|pontificio|borbon/.test(d)) return 'basic-v2';
  if (/torino|napoli|firenze|roma capitale|palermo|proclamaz|teano|incontro|parigi|marsiglia/.test(d)) return 'streets-v2';
  if (/guerra|invade|invasion|armistizio|cession|plebiscito/.test(d)) return 'basic-v2';
  if (/cavour|mazzini|garibaldi|vittorio emanuele|quattro uomini/.test(d)) return 'streets-v2';
  if (/transizion|introduz|domanda|conclus|sintesi/.test(d)) return 'basic-v2';
  return 'satellite-hybrid';
}

// Zoom/pitch helpers
function pickZoom(desc) {
  const d = (desc || '').toLowerCase();
  if (/mondo|spazio|europ|penisola|tutta.*italia|intera/.test(d)) return 4.5;
  if (/sintesi|dominio|panoram|domini|stati pre|nord italia|sud italia/.test(d)) return 5.3;
  if (/regno|stato|granducato|ducato|lombardo|pontificio|sicilie/.test(d)) return 6.2;
  if (/milano|napoli|torino|firenze|palermo|vienna|parigi|roma|genova|modena|parma|venez|marsiglia|teano|marsala|caprera|bologna|quarto|plombi/.test(d)) return 9.2;
  if (/battaglia|solferino|magenta|custoza|volturno|calatafimi|messina|milazzo|porta pia|breccia/.test(d)) return 10.2;
  return 6.3;
}

function pickPitch(desc, zoom) {
  const d = (desc || '').toLowerCase();
  if (/spazio|mondo|panoram/.test(d)) return 10;
  if (/battaglia|breccia|porta pia|solferino|massacro|fuga|morte|muore/.test(d)) return 55;
  if (zoom >= 9) return 45;
  if (zoom >= 7) return 35;
  return 22;
}

const total = plan.scenes.length;
for (let i = 0; i < total; i++) {
  const s = plan.scenes[i];
  const desc = s.description || '';

  // 1. Stile per scena
  s.style = pickStyle(desc, i, total);

  // 2. Fix camera (se zoom invalido / statico)
  const cs = s.camera.start, ce = s.camera.end;
  const targetZoom = pickZoom(desc);
  const targetPitch = pickPitch(desc, targetZoom);
  if (!Number.isFinite(cs.zoom) || cs.zoom < 2 || cs.zoom > 14) cs.zoom = targetZoom;
  if (!Number.isFinite(ce.zoom) || ce.zoom < 2 || ce.zoom > 14) ce.zoom = targetZoom;
  if (Math.abs(cs.zoom - ce.zoom) < 0.1) {
    cs.zoom = Math.max(2, targetZoom - 1.3);
    ce.zoom = Math.min(14, targetZoom + 0.7);
  }
  if (!Number.isFinite(cs.pitch) || cs.pitch < 0 || cs.pitch > 60) cs.pitch = 0;
  if (!Number.isFinite(ce.pitch) || ce.pitch < 0 || ce.pitch > 60) ce.pitch = targetPitch;
  if (cs.pitch === ce.pitch) {
    cs.pitch = Math.max(0, targetPitch - 22);
    ce.pitch = Math.min(60, targetPitch);
  }
  if (!Number.isFinite(cs.bearing)) cs.bearing = 0;
  if (!Number.isFinite(ce.bearing)) ce.bearing = 0;
  if (cs.bearing === ce.bearing) ce.bearing = cs.bearing + (i % 2 === 0 ? 5 : -5);
  if (cs.center[0] === ce.center[0] && cs.center[1] === ce.center[1]) {
    ce.center = [ce.center[0] + 0.25, ce.center[1] - 0.1];
  }

  // 3. Patch overlays
  const newOverlays = [];
  const existing = s.overlays || [];
  for (const o of existing) {
    // highlight country=IT in scene pre-1861 → sostituisci con preset storico
    if (o.type === 'highlight' && o.country && o.country.toLowerCase() === 'it') {
      const preset = pickPreset(desc);
      if (preset) {
        delete o.country;
        o.preset = preset;
        o.pattern = 'hatch';
        o.label = o.label || null;
      } else {
        // Scene dopo 1861: Italia è legittima, ma meglio senza bandiera → usa tricolore solid
        delete o.country;
        o.color = o.color || '#046A38';
        o.pattern = 'solid';
      }
    }
    // highlight generico senza preset e con description che indica stato storico
    if (o.type === 'highlight' && !o.preset && !o.country) {
      const preset = pickPreset(desc);
      if (preset) {
        o.preset = preset;
        o.pattern = 'hatch';
      }
    }
    // Route: attiva moving marker se è una rotta narrativa
    if (o.type === 'route' && !o.moving) {
      o.moving = true;
      o.icon = pickRouteIcon(o.label, desc);
    }
    newOverlays.push(o);
  }

  // 4. Aggiungi timeline anno per scena (se non già presente)
  const year = pickYear(desc);
  if (year && !newOverlays.some((o) => o.type === 'timeline')) {
    newOverlays.push({
      type: 'timeline',
      year,
      appearAt: s.startTime + 0.3,
      durationSec: Math.max(2, (s.endTime - s.startTime) - 0.6),
    });
  }

  s.overlays = newOverlays;
}

// 5. Aggiungi highlight degli stati preunitari quando la scena li enumera
for (const s of plan.scenes) {
  const d = (s.description || '').toLowerCase();
  if (/domini austriaci|lombardo.veneto.*parma.*modena|stati pre|frammentazione|otto stati|8 stati/.test(d)) {
    const baseT = s.startTime + 0.5;
    const presets = ['lombardo-veneto', 'parma', 'modena', 'toscana', 'pontificio', 'due-sicilie', 'sardegna'];
    // se già presenti highlight per qualche preset, non duplicare
    const already = new Set((s.overlays || []).filter((o) => o.preset).map((o) => o.preset));
    const span = Math.max(0.3, (s.endTime - s.startTime) / presets.length);
    let i = 0;
    for (const p of presets) {
      if (already.has(p)) continue;
      s.overlays.push({
        type: 'highlight',
        preset: p,
        appearAt: baseT + i * 0.6,
        durationSec: Math.max(3, s.endTime - s.startTime - i * 0.4),
        pattern: 'hatch',
        label: null,
      });
      i++;
    }
  }
}

writeFileSync(path, JSON.stringify(plan, null, 2));

// Stampa riepilogo
const counts = {preset: 0, country: 0, timeline: 0, route: 0, routeMoving: 0, pin: 0, pulse: 0, label: 0, era: 0};
for (const s of plan.scenes) for (const o of s.overlays || []) {
  if (o.type === 'highlight' && o.preset) counts.preset++;
  else if (o.type === 'highlight' && o.country) counts.country++;
  else if (o.type === 'route') { counts.route++; if (o.moving) counts.routeMoving++; }
  else if (o.type in counts) counts[o.type]++;
}
console.log('✓ plan patchato');
console.log('overlays totali:', counts);
console.log('scene:', plan.scenes.length, 'durata:', plan.duration, 's');
