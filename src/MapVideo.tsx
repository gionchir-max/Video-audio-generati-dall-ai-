import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender, interpolate} from 'remotion';
import {useEffect, useRef, useState, useMemo} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Subtitles} from './Subtitles';
import {TopBanner} from './TopBanner';
import {SoundEffects} from './SoundEffects';
import banner from './banner.json';
import plan from './map-plan.json';
import {loadFont as loadBold} from '@remotion/google-fonts/OpenSans';

const {fontFamily} = loadBold('normal', {weights: ['700', '800']});

const KEY = (process.env.REMOTION_MAPTILER_KEY || '') as string;

type Camera = {center: [number, number]; zoom: number; bearing: number; pitch: number};
type Scene = {
  startTime: number;
  endTime: number;
  description?: string;
  style?: string;
  camera: {start: Camera; end: Camera};
  overlays?: Overlay[];
};
type Overlay =
  | {type: 'pin'; lng: number; lat: number; label?: string; appearAt: number; color?: string}
  | {type: 'pulse'; lng: number; lat: number; appearAt: number; color?: string}
  | {type: 'label'; lng: number; lat: number; text: string; appearAt: number; size?: 'sm' | 'md' | 'lg' | 'xl'}
  | {type: 'era'; text: string; appearAt: number; durationSec?: number; position?: 'top' | 'bottom'}
  | {type: 'route'; coords: [number, number][]; label?: string; drawFrom: number; drawTo: number; color?: string; startLabel?: string; endLabel?: string}
  | {type: 'highlight'; coords: [number, number][] | [number, number][][]; label?: string; appearAt: number; color?: string; country?: string};

const PLAN = plan as {duration: number; fps: number; style?: string; scenes: Scene[]};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function styleUrl(style: string | undefined) {
  const s = style || PLAN.style || 'hybrid';
  // MapTiler style slugs
  const slug =
    s === 'dark' ? 'streets-dark-v2'
    : s === 'satellite' ? 'satellite'
    : s === 'streets' ? 'streets-v2'
    : s === 'satellite-hybrid' ? 'hybrid'
    : s;
  return `https://api.maptiler.com/maps/${slug}/style.json?key=${KEY}`;
}

function activeScene(time: number): {scene: Scene; progress: number} {
  const scenes = PLAN.scenes;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (time >= s.startTime && time < s.endTime) {
      const p = (time - s.startTime) / Math.max(0.001, s.endTime - s.startTime);
      return {scene: s, progress: p};
    }
  }
  const last = scenes[scenes.length - 1];
  return {scene: last, progress: 1};
}

function interpCamera(scene: Scene, progress: number): Camera {
  const t = easeInOutCubic(progress);
  const s = scene.camera.start;
  const e = scene.camera.end;
  return {
    center: [lerp(s.center[0], e.center[0], t), lerp(s.center[1], e.center[1], t)],
    zoom: lerp(s.zoom, e.zoom, t),
    bearing: lerp(s.bearing, e.bearing, t),
    pitch: lerp(s.pitch, e.pitch, t),
  };
}

type ProjectedOverlay = Overlay & {
  screen: {x: number; y: number} | null;
  screenPath?: {x: number; y: number}[];
  screenPolygons?: {x: number; y: number}[][];
};

// Zone verticali sicure: evitare la fascia sottotitoli (y = 40-62% schermo)
const SUBTITLE_BAND = {top: 0.40, bottom: 0.62};
const BANNER_BAND = {top: 0.0, bottom: 0.14}; // primi 10s: banner in alto
function avoidBands(y: number, height: number, time: number): number {
  const yNorm = y / height;
  // Evita sempre fascia sottotitoli
  if (yNorm >= SUBTITLE_BAND.top && yNorm <= SUBTITLE_BAND.bottom) {
    const distTop = yNorm - SUBTITLE_BAND.top;
    const distBot = SUBTITLE_BAND.bottom - yNorm;
    if (distTop < distBot) return (SUBTITLE_BAND.top - 0.02) * height; // push sopra
    return (SUBTITLE_BAND.bottom + 0.02) * height; // push sotto
  }
  // Evita fascia banner nei primi 10s
  if (time < 10 && yNorm >= BANNER_BAND.top && yNorm <= BANNER_BAND.bottom) {
    return (BANNER_BAND.bottom + 0.02) * height;
  }
  return y;
}

function clampX(x: number, width: number, halfBoxW: number): number {
  const margin = 20;
  return Math.min(Math.max(x, halfBoxW + margin), width - halfBoxW - margin);
}

function isOnScreen(p: {x: number; y: number}, width: number, height: number, margin = 60) {
  return p.x >= -margin && p.x <= width + margin && p.y >= -margin && p.y <= height + margin;
}

function simplifyRing(ring: [number, number][], stride: number): [number, number][] {
  if (ring.length <= 60) return ring;
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i += stride) out.push(ring[i]);
  if (out[out.length - 1] !== ring[ring.length - 1]) out.push(ring[ring.length - 1]);
  return out;
}

export const MapVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const time = frame / fps;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [initHandle] = useState(() => delayRender('maplibre-init'));
  const [countriesHandle] = useState(() => delayRender('countries-load'));
  const [mapReady, setMapReady] = useState(false);
  const [projections, setProjections] = useState<ProjectedOverlay[]>([]);
  const countriesRef = useRef<Map<string, [number, number][][]>>(new Map());

  // Load countries geojson once
  useEffect(() => {
    fetch(staticFile('countries.geojson'))
      .then((r) => r.json())
      .then((gj: {features: {properties: Record<string, string>; geometry: {type: string; coordinates: any}}[]}) => {
        const byIso = new Map<string, [number, number][][]>();
        for (const f of gj.features) {
          const iso = (f.properties['ISO3166-1-Alpha-2'] || '').toLowerCase();
          if (!iso) continue;
          const rings: [number, number][][] = [];
          if (f.geometry.type === 'Polygon') {
            for (const ring of f.geometry.coordinates as [number, number][][]) {
              rings.push(simplifyRing(ring, 3));
            }
          } else if (f.geometry.type === 'MultiPolygon') {
            for (const poly of f.geometry.coordinates as [number, number][][][]) {
              for (const ring of poly) rings.push(simplifyRing(ring, 3));
            }
          }
          byIso.set(iso, rings);
        }
        countriesRef.current = byIso;
        continueRender(countriesHandle);
      })
      .catch((e) => {
        console.warn('countries load failed', e);
        continueRender(countriesHandle);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bannerDurationFrames = 10 * fps;

  // All overlays flattened with scene binding
  const overlays = useMemo<Overlay[]>(() => {
    const all: Overlay[] = [];
    for (const sc of PLAN.scenes) for (const o of sc.overlays || []) all.push(o);
    return all;
  }, []);

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    // Force explicit pixel dimensions BEFORE MapLibre measures the container
    mapContainerRef.current.style.width = `${width}px`;
    mapContainerRef.current.style.height = `${height}px`;
    const first = PLAN.scenes[0];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl(first.style),
      center: first.camera.start.center,
      zoom: first.camera.start.zoom,
      bearing: first.camera.start.bearing,
      pitch: first.camera.start.pitch,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    mapRef.current = map;
    map.on('load', () => {
      map.resize();
      setMapReady(true);
      continueRender(initHandle);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-frame camera update + project overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const {scene, progress} = activeScene(time);
    const cam = interpCamera(scene, progress);
    map.jumpTo({
      center: cam.center,
      zoom: cam.zoom,
      bearing: cam.bearing,
      pitch: cam.pitch,
    });

    // Project overlays to screen
    const projected: ProjectedOverlay[] = overlays.map((o) => {
      if (o.type === 'route') {
        const pts = (o.coords || [])
          .filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map(([lng, lat]) => {
            const p = map.project([lng, lat]);
            return {x: p.x, y: p.y};
          });
        return {...o, screen: pts[0] ?? null, screenPath: pts};
      }
      if (o.type === 'highlight') {
        // Se ha country ISO code, usa il poligono reale dal geojson
        const isoCode = o.country?.toLowerCase();
        let rings: [number, number][][] = [];
        if (isoCode && countriesRef.current.has(isoCode)) {
          rings = countriesRef.current.get(isoCode)!;
        } else if (o.coords && Array.isArray(o.coords) && o.coords.length > 0) {
          // Fallback: coords fornite dal plan (possono essere singola ring o multi)
          const raw = Array.isArray((o.coords as any)[0]?.[0])
            ? (o.coords as [number, number][][])
            : [o.coords as [number, number][]];
          rings = raw;
        } else {
          rings = [];
        }
        const screenPolygons = rings.map((ring) =>
          ring
            .filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
            .map(([lng, lat]) => {
              const p = map.project([lng, lat]);
              return {x: p.x, y: p.y};
            }),
        ).filter((r) => r.length >= 3);
        const first = screenPolygons[0]?.[0] ?? null;
        return {...o, screen: first, screenPolygons};
      }
      const lng = (o as any).lng;
      const lat = (o as any).lat;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return {...o, screen: null};
      }
      const p = map.project([lng, lat]);
      // Nascondi overlay se la sua posizione geografica è ampiamente fuori schermo
      const margin = 60;
      const onscreen = p.x >= -margin && p.x <= width + margin && p.y >= -margin && p.y <= height + margin;
      return {...o, screen: onscreen ? {x: p.x, y: p.y} : null};
    });
    setProjections(projected);

    // Wait for tiles before the frame is captured
    const h = delayRender(`frame-${frame}`);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      continueRender(h);
    };
    if (map.areTilesLoaded()) {
      // microtask to allow pending paints
      setTimeout(release, 0);
    } else {
      const onIdle = () => {
        release();
        map.off('idle', onIdle);
      };
      map.once('idle', onIdle);
      // safety: don't block longer than 8s per frame
      setTimeout(() => {
        map.off('idle', onIdle);
        release();
      }, 8000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, mapReady]);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          filter: 'saturate(1.15) contrast(1.18) brightness(0.88) hue-rotate(-8deg)',
        }}
      />
      {/* Tint teal per look editoriale */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(8,30,48,0.35) 0%, rgba(6,26,42,0.25) 100%)',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Overlays SVG layer */}
      <svg
        width={width}
        height={height}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        {projections.map((o, i) => {
          if (o.type === 'era') {
            if (time < o.appearAt) return null;
            const dur = o.durationSec ?? 2.5;
            const tEnd = o.appearAt + dur;
            if (time > tEnd + 0.4) return null;
            const fadeIn = Math.max(0, Math.min(1, (time - o.appearAt) / 0.35));
            const fadeOut = Math.max(0, Math.min(1, (tEnd - time) / 0.35));
            const op = Math.min(fadeIn, fadeOut);
            let size = 170;
            // fit-to-width: scala se supera 92% schermo
            const maxW = width * 0.92;
            const approxW = measureText(o.text, size) + (o.text.length - 1) * 3;
            if (approxW > maxW) size = size * (maxW / approxW);
            // Era fra 0-10s: banner occupa il top → forza bottom
            const effectivePos = (time < 10 ? 'bottom' : (o.position ?? 'top'));
            const y = effectivePos === 'bottom' ? height * 0.78 : height * 0.24;
            const scale = interpolate(fadeIn, [0, 1], [0.85, 1], {easing: (x) => 1 - Math.pow(1 - x, 3)});
            return (
              <g key={i} transform={`translate(${width / 2}, ${y}) scale(${scale})`} opacity={op}>
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily={fontFamily}
                  fontWeight={900}
                  fontSize={size}
                  fill="#fff"
                  stroke="rgba(0,0,0,0.85)"
                  strokeWidth={6}
                  paintOrder="stroke fill"
                  letterSpacing={3}
                  style={{textTransform: 'uppercase'}}
                >
                  {o.text}
                </text>
              </g>
            );
          }
          if (o.type === 'highlight') {
            if (!o.screenPolygons || o.screenPolygons.length === 0) return null;
            if (time < o.appearAt) return null;
            // Highlight rimane visibile 6s dopo l'appearAt, poi scompare
            if (time > o.appearAt + 6) return null;
            // Se il poligono è interamente fuori schermo, skip
            {
              let anyOn = false;
              for (const ring of o.screenPolygons) {
                for (const p of ring) {
                  if (p.x >= -100 && p.x <= width + 100 && p.y >= -100 && p.y <= height + 100) {
                    anyOn = true;
                    break;
                  }
                }
                if (anyOn) break;
              }
              if (!anyOn) return null;
            }
            const t = Math.max(0, Math.min(1, (time - o.appearAt) / 0.6));
            const color = o.color || '#ff3b3b';
            const d = o.screenPolygons
              .map((ring) => ring.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z')
              .join(' ');
            // Bounding box di tutti i ring
            let bx = Infinity, by = Infinity, bx2 = -Infinity, by2 = -Infinity;
            for (const ring of o.screenPolygons) for (const p of ring) {
              if (p.x < bx) bx = p.x;
              if (p.x > bx2) bx2 = p.x;
              if (p.y < by) by = p.y;
              if (p.y > by2) by2 = p.y;
            }
            const cx = (bx + bx2) / 2;
            const cy = (by + by2) / 2;
            const fadeOut = Math.max(0, Math.min(1, (o.appearAt + 6 - time) / 1));
            const strokeOp = interpolate(t, [0, 1], [0, 0.98]) * fadeOut;
            const flagCode = o.country?.toLowerCase();
            const clipId = `hl-clip-${i}`;
            const hasFlag = Boolean(flagCode);
            const fillOp = interpolate(t, [0, 1], [0, hasFlag ? 0.92 : 0.4]) * fadeOut;
            return (
              <g key={i}>
                {hasFlag && (
                  <defs>
                    <clipPath id={clipId}>
                      <path d={d} fillRule="evenodd" />
                    </clipPath>
                  </defs>
                )}
                {hasFlag ? (
                  <image
                    href={`https://flagcdn.com/w1280/${flagCode}.png`}
                    x={bx}
                    y={by}
                    width={bx2 - bx}
                    height={by2 - by}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${clipId})`}
                    opacity={fillOp}
                  />
                ) : (
                  <path d={d} fill={color} fillRule="evenodd" opacity={fillOp} />
                )}
                <path d={d} fill="none" stroke={color} strokeWidth={4} opacity={strokeOp} strokeLinejoin="round" />
                {o.label && t > 0.5 && isOnScreen({x: cx, y: cy}, width, height, 20) && (
                  <text
                    x={cx}
                    y={avoidBands(cy, height, time)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontFamily={fontFamily}
                    fontWeight={900}
                    fontSize={60}
                    fill="#fff"
                    stroke="rgba(0,0,0,0.9)"
                    strokeWidth={5}
                    paintOrder="stroke fill"
                    letterSpacing={2}
                    opacity={interpolate(t, [0.5, 1], [0, 1]) * fadeOut}
                    style={{textTransform: 'uppercase'}}
                  >
                    {o.label}
                  </text>
                )}
              </g>
            );
          }
          if (o.type === 'route') {
            if (!o.screenPath || o.screenPath.length < 2) return null;
            // La rotta scompare 3s dopo la fine del disegno
            if (time > o.drawTo + 3) return null;
            const d = o.screenPath.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
            const total = o.drawTo - o.drawFrom;
            const prog = Math.max(0, Math.min(1, (time - o.drawFrom) / Math.max(0.001, total)));
            const routeAlpha = time > o.drawTo + 1.5 ? Math.max(0, Math.min(1, (o.drawTo + 3 - time) / 1.5)) : 1;
            let len = 0;
            for (let k = 1; k < o.screenPath.length; k++) {
              const a = o.screenPath[k - 1];
              const b = o.screenPath[k];
              len += Math.hypot(b.x - a.x, b.y - a.y);
            }
            const dash = len * prog;
            const color = o.color || '#00e5ff';
            if (time < o.drawFrom) return null;
            const start = o.screenPath[0];
            const end = o.screenPath[o.screenPath.length - 1];
            return (
              <g key={i} opacity={routeAlpha}>
                {/* glow */}
                <path d={d} fill="none" stroke={color} strokeWidth={12} strokeDasharray={`${dash} ${len}`} strokeLinecap="round" strokeLinejoin="round" opacity={0.25} />
                {/* dark underline */}
                <path d={d} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={6} strokeDasharray={`${dash} ${len}`} strokeLinecap="round" strokeLinejoin="round" />
                {/* main line */}
                <path d={d} fill="none" stroke={color} strokeWidth={3.5} strokeDasharray={`${dash} ${len}`} strokeLinecap="round" strokeLinejoin="round" />
                {/* endpoint markers */}
                <circle cx={start.x} cy={start.y} r={7} fill="#fff" stroke={color} strokeWidth={3} />
                {prog >= 0.98 && (
                  <circle cx={end.x} cy={end.y} r={7} fill="#fff" stroke={color} strokeWidth={3} />
                )}
                {/* endpoint labels (solo se on-screen) */}
                {o.startLabel && isOnScreen(start, width, height) && (
                  <EndpointLabel x={start.x} y={start.y} text={o.startLabel} color={color} placement="below" safeY={avoidBands(start.y + 22, height, time)} />
                )}
                {o.endLabel && prog >= 0.9 && isOnScreen(end, width, height) && (
                  <EndpointLabel x={end.x} y={end.y} text={o.endLabel} color={color} placement="below" safeY={avoidBands(end.y + 22, height, time)} appearProgress={Math.max(0, Math.min(1, (prog - 0.9) / 0.1))} />
                )}
                {/* center route label (e.g. nome gasdotto) */}
                {o.label && prog > 0.5 && o.screenPath.length >= 2 && (() => {
                  const mid = midpointOfPath(o.screenPath);
                  const safeMid = {x: mid.x, y: avoidBands(mid.y, height, time)};
                  return (
                    <RouteLabel
                      midpoint={safeMid}
                      text={o.label}
                      color={color}
                      appearProgress={Math.max(0, Math.min(1, (prog - 0.5) / 0.25))}
                    />
                  );
                })()}
              </g>
            );
          }
          if (o.type === 'pin') {
            if (!o.screen) return null;
            if (time < o.appearAt) return null;
            const t = Math.max(0, Math.min(1, (time - o.appearAt) / 0.5));
            const scale = interpolate(t, [0, 1], [0.3, 1], {easing: (x) => 1 - Math.pow(1 - x, 3)});
            const px = o.screen!.x;
            const py = o.screen!.y;
            const wantLabelY = py - 40; // label sopra il pin
            const safeLabelY = avoidBands(wantLabelY, height, time);
            const pinHalfW = o.label ? measureText(o.label, 24) / 2 + 14 : 30;
            const safeLabelX = clampX(px, width, pinHalfW);
            return (
              <PinDot
                key={i}
                x={px}
                y={py}
                scale={scale}
                label={o.label}
                color={o.color || '#ffcc00'}
                pulsePhase={(time - o.appearAt) * 2}
                labelY={safeLabelY}
                labelX={safeLabelX}
              />
            );
          }
          if (o.type === 'pulse') {
            if (!o.screen) return null;
            if (time < o.appearAt) return null;
            const t = (time - o.appearAt) * 2; // period 0.5s
            const phase = t % 1;
            const r = interpolate(phase, [0, 1], [10, 80]);
            const op = interpolate(phase, [0, 1], [0.9, 0]);
            const color = o.color || '#ff3b3b';
            return (
              <g key={i}>
                <circle cx={o.screen!.x} cy={o.screen!.y} r={r} fill="none" stroke={color} strokeWidth={4} opacity={op} />
                <circle cx={o.screen!.x} cy={o.screen!.y} r={10} fill={color} opacity={0.95} />
              </g>
            );
          }
          if (o.type === 'label') {
            if (time < o.appearAt) return null;
            const t = Math.max(0, Math.min(1, (time - o.appearAt) / 0.4));
            const endFade = Math.max(0, Math.min(1, (o.appearAt + 4 - time) / 0.4));
            const op = Math.min(interpolate(t, [0, 1], [0, 1]), endFade);
            if (op <= 0) return null;
            const size = o.size === 'xl' ? 84 : o.size === 'lg' ? 58 : o.size === 'sm' ? 30 : 42;
            // HUD pos: in alto subito sotto il banner (dopo 10s)
            const hudY = time < 10 ? height * 0.38 : height * 0.17;
            const safeY = avoidBands(hudY, height, time);
            const cx = width / 2;
            return (
              <g key={i} transform={`translate(${cx}, ${safeY})`} opacity={op}>
                <rect
                  x={-measureText(o.text, size) / 2 - 24}
                  y={-size * 0.85}
                  width={measureText(o.text, size) + 48}
                  height={size * 1.4}
                  rx={8}
                  fill="rgba(0,0,0,0.92)"
                  stroke="#ffcc00"
                  strokeWidth={3}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  y={-size * 0.05}
                  fontFamily={fontFamily}
                  fontWeight={900}
                  fontSize={size}
                  fill="#ffcc00"
                  letterSpacing={1.5}
                  style={{textTransform: 'uppercase'}}
                >
                  {o.text}
                </text>
              </g>
            );
          }
          return null;
        })}
      </svg>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%), linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%)',
          pointerEvents: 'none',
        }}
      />

      <Audio src={staticFile('voiceover.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.15} loop />

      <SoundEffects />
      <TopBanner text={banner.text} durationInFrames={bannerDurationFrames} />
      <Subtitles />
    </AbsoluteFill>
  );
};

function measureText(s: string, size: number) {
  return s.length * size * 0.58;
}

function midpointOfPath(pts: {x: number; y: number}[]) {
  // find midpoint by arc length
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let target = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const segLen = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (target <= segLen) {
      const t = target / segLen;
      return {x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t};
    }
    target -= segLen;
  }
  return pts[Math.floor(pts.length / 2)];
}

const PinDot: React.FC<{x: number; y: number; scale: number; label?: string; color: string; pulsePhase: number; labelY?: number; labelX?: number}> = ({x, y, scale, label, color, pulsePhase, labelY, labelX}) => {
  const phase = pulsePhase % 1;
  const pulseR = interpolate(phase, [0, 1], [14, 48]);
  const pulseOp = interpolate(phase, [0, 1], [0.8, 0]);
  const effectiveLabelY = labelY ?? y - 40;
  const labelOffsetY = effectiveLabelY - y; // in coordinate locali alla scala del gruppo
  return (
    <>
      <g transform={`translate(${x}, ${y}) scale(${scale})`}>
        <circle r={pulseR} fill="none" stroke={color} strokeWidth={3} opacity={pulseOp} />
        <circle r={14} fill={color} stroke="#000" strokeWidth={3} />
        <circle r={5} fill="#000" />
      </g>
      {label && (
        <g transform={`translate(${labelX ?? x}, ${effectiveLabelY})`}>
          {/* connettore dal pin al label se spostato */}
          {(Math.abs(labelOffsetY) > 60 || Math.abs((labelX ?? x) - x) > 40) && (
            <line
              x1={x - (labelX ?? x)}
              y1={y - effectiveLabelY}
              x2={0}
              y2={14}
              stroke={color}
              strokeWidth={2}
              strokeDasharray="4 4"
              opacity={0.85}
            />
          )}
          <rect
            x={-measureText(label, 24) / 2 - 14}
            y={-24}
            width={measureText(label, 24) + 28}
            height={38}
            rx={10}
            fill="rgba(0,0,0,0.88)"
            stroke={color}
            strokeWidth={3}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            y={-4}
            fontFamily={fontFamily}
            fontWeight={800}
            fontSize={24}
            fill="#fff"
            style={{textTransform: 'uppercase'}}
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
};

const RouteLabel: React.FC<{midpoint: {x: number; y: number}; text: string; appearProgress: number; color?: string}> = ({midpoint, text, appearProgress, color}) => {
  const size = 30;
  const strokeCol = color || '#00e5ff';
  return (
    <g transform={`translate(${midpoint.x}, ${midpoint.y})`} opacity={appearProgress}>
      <rect
        x={-measureText(text, size) / 2 - 18}
        y={-size * 0.9}
        width={measureText(text, size) + 36}
        height={size * 1.45}
        rx={6}
        fill="rgba(0,0,0,0.92)"
        stroke={strokeCol}
        strokeWidth={2.5}
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        y={-size * 0.05}
        fontFamily={fontFamily}
        fontWeight={800}
        fontSize={size}
        fill="#fff"
        letterSpacing={1.5}
        style={{textTransform: 'uppercase'}}
      >
        {text}
      </text>
    </g>
  );
};

const EndpointLabel: React.FC<{x: number; y: number; text: string; color: string; placement?: 'below' | 'above'; safeY?: number; appearProgress?: number}> = ({x, y, text, color, safeY, appearProgress}) => {
  const size = 22;
  const halfW = measureText(text, size) / 2 + 12;
  const ty = safeY ?? y + 22;
  return (
    <g transform={`translate(${x}, ${ty})`} opacity={appearProgress ?? 1}>
      <rect
        x={-halfW}
        y={-size * 0.85}
        width={halfW * 2}
        height={size * 1.4}
        rx={5}
        fill={color}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={1}
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        y={-size * 0.05}
        fontFamily={fontFamily}
        fontWeight={800}
        fontSize={size}
        fill="#002233"
        letterSpacing={0.8}
        style={{textTransform: 'uppercase'}}
      >
        {text}
      </text>
    </g>
  );
};
