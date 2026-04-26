import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile, random} from 'remotion';
import {P} from './palette';
import {Camera} from './components/Camera';
import {Particles} from './components/Particles';
import {Vignette, ColorGrade} from './components/Vignette';
import {BoySilhouette, GrandpaSilhouette, ManSilhouette} from './components/Characters';

const W = 1080;
const H = 1920;
const DUR = 75; // 2.5s shot

// ------------------------------------------------------------------
// Sfondi & elementi riutilizzabili
// ------------------------------------------------------------------

const SkyGradient: React.FC<{top: string; mid: string; bottom: string; grade?: string}> = ({
  top, mid, bottom, grade,
}) => (
  <AbsoluteFill>
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        {grade && (
          <radialGradient id="sunGlow" cx="50%" cy="70%" r="60%">
            <stop offset="0%" stopColor={grade} stopOpacity="0.55" />
            <stop offset="100%" stopColor={grade} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      {grade && <rect width={W} height={H} fill="url(#sunGlow)" />}
    </svg>
  </AbsoluteFill>
);

const Hills: React.FC<{y: number; color: string; seed: string; amp?: number}> = ({y, color, seed, amp = 60}) => {
  const pts: string[] = [`M 0 ${y + 200}`, `L 0 ${y}`];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    const h = y - (Math.sin(i * 0.7 + random(seed + i) * 2) * amp) - random(seed + 'b' + i) * amp * 0.5;
    pts.push(`L ${x} ${h}`);
  }
  pts.push(`L ${W} ${y}`);
  pts.push(`L ${W} ${y + 200}`);
  pts.push('Z');
  return <path d={pts.join(' ')} fill={color} />;
};

const DryGrass: React.FC<{y: number; count?: number; frame: number; seed?: string; scale?: number}> = ({
  y, count = 70, frame, seed = 'g', scale = 1,
}) => {
  const blades = Array.from({length: count}).map((_, i) => {
    const x = random(seed + i) * W;
    const h = 40 + random(seed + 'h' + i) * 50;
    const bend = Math.sin(frame * 0.06 + i) * (4 + random(seed + 'b' + i) * 6);
    const col = random(seed + 'c' + i) > 0.5 ? P.grassDry : P.grassDryDark;
    return (
      <path
        key={i}
        d={`M ${x} ${y} Q ${x + bend} ${y - h / 2} ${x + bend * 1.2} ${y - h * scale}`}
        stroke={col}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    );
  });
  return <g>{blades}</g>;
};

const Flame: React.FC<{x: number; y: number; scale?: number; frame: number; seed?: string}> = ({
  x, y, scale = 1, frame, seed = 'f',
}) => {
  const wob = Math.sin(frame * 0.25 + random(seed) * 10) * 6;
  const h1 = 140 + Math.sin(frame * 0.35) * 20;
  const h2 = 90 + Math.cos(frame * 0.4 + 1) * 15;
  const h3 = 45 + Math.sin(frame * 0.5 + 2) * 10;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <defs>
        <linearGradient id={`fl-${seed}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={P.fireDeep} />
          <stop offset="55%" stopColor={P.fireMid} />
          <stop offset="100%" stopColor={P.fireCore} />
        </linearGradient>
      </defs>
      <path
        d={`M -70 0 Q ${-35 + wob} -60 ${-20 + wob} -${h1} Q ${wob} -${h1 + 40} ${20 + wob} -${h1} Q ${35 + wob} -60 70 0 Z`}
        fill={`url(#fl-${seed})`}
      />
      <path
        d={`M -40 0 Q -20 -30 ${-10 + wob * 0.5} -${h2} Q ${wob * 0.5} -${h2 + 25} ${10 + wob * 0.5} -${h2} Q 20 -30 40 0 Z`}
        fill={P.fireMid}
        opacity={0.85}
      />
      <path
        d={`M -18 0 Q -10 -15 ${-4 + wob * 0.3} -${h3} Q ${wob * 0.3} -${h3 + 12} ${4 + wob * 0.3} -${h3} Q 10 -15 18 0 Z`}
        fill={P.fireCore}
        opacity={0.9}
      />
    </g>
  );
};

const SmokePlume: React.FC<{x: number; y: number; frame: number; scale?: number; seed?: string}> = ({
  x, y, frame, scale = 1, seed = 's',
}) => {
  const puffs = Array.from({length: 12}).map((_, i) => {
    const life = ((frame + i * 8 + random(seed + i) * 50) % 120) / 120;
    const yy = -life * 600;
    const xx = Math.sin(life * Math.PI * 2 + i) * 50 + (random(seed + 'x' + i) - 0.5) * 40;
    const r = 40 + life * 90;
    const op = Math.sin(life * Math.PI) * 0.55;
    return <circle key={i} cx={xx} cy={yy} r={r} fill={P.smoke} opacity={op} />;
  });
  return <g transform={`translate(${x},${y}) scale(${scale})`}>{puffs}</g>;
};

// ------------------------------------------------------------------
// SHOT 01 — Wide uomo su terra arida
// ------------------------------------------------------------------
export const Shot01: React.FC = () => {
  const frame = useCurrentFrame();
  const manBreathe = Math.sin(frame * 0.1) * 2;
  return (
    <Camera duration={DUR} move={{from: {scale: 1}, to: {scale: 1.08}}}>
      <SkyGradient top={P.skyTop} mid={P.skyHorizon} bottom={P.earthDry1} grade={P.duskGold} />
      {/* sole */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <circle cx={W * 0.72} cy={H * 0.35} r={140} fill={P.fireCore} opacity={0.85} />
        <circle cx={W * 0.72} cy={H * 0.35} r={220} fill={P.fireCore} opacity={0.25} />
      </svg>
      {/* colline distanti */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Hills y={H * 0.55} color={P.earthDry2} seed="h1" amp={80} />
        <Hills y={H * 0.62} color={'#7A4E1A'} seed="h2" amp={50} />
        <Hills y={H * 0.70} color={P.grassDryDark} seed="h3" amp={40} />
      </svg>
      {/* cracked earth foreground */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={0} y={H * 0.70} width={W} height={H * 0.30} fill={P.earthDry1} />
        <path d={`M 0 ${H * 0.72} Q ${W / 2} ${H * 0.68} ${W} ${H * 0.72} L ${W} ${H * 0.75} L 0 ${H * 0.75} Z`} fill={P.earthDry2} opacity={0.5} />
        {/* crepe */}
        <path d="M 120 1420 L 280 1560 L 360 1680 L 220 1820" stroke={P.inkDark} strokeWidth="2" fill="none" opacity={0.5} />
        <path d="M 700 1460 L 820 1600 L 760 1740 L 900 1880" stroke={P.inkDark} strokeWidth="2" fill="none" opacity={0.5} />
        {/* erba secca */}
        <DryGrass y={H * 0.80} count={120} frame={frame} seed="gg1" />
        <DryGrass y={H * 0.92} count={120} frame={frame + 10} seed="gg2" scale={1.2} />
      </svg>
      {/* uomo silhouette - leggermente spostato a sinistra */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.42},${H * 0.68 + manBreathe})`}>
          <ManSilhouette x={0} y={0} scale={1.3} pose="stand" />
          {/* ombra */}
          <ellipse cx="0" cy="325" rx="55" ry="10" fill={P.inkDark} opacity={0.35} />
        </g>
      </svg>
      <Particles count={40} color={P.paperCream} size={[1, 3]} speed={[10, 25]} spread={{x: [0, 1], y: [0.2, 1]}} direction="drift" seed="dust1" life={150} blur={1} />
      <ColorGrade tint={P.duskGold} opacity={0.12} />
      <Vignette strength={0.6} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 02 — Thought bubble memoria
// ------------------------------------------------------------------
export const Shot02: React.FC = () => {
  const frame = useCurrentFrame();
  const bubbleScale = spring({frame, fps: 30, config: {damping: 12, stiffness: 90}});
  const pulse = 1 + Math.sin(frame * 0.12) * 0.015;
  return (
    <Camera duration={DUR} move={{from: {scale: 1.08, y: 0}, to: {scale: 1.18, y: -30}}}>
      <SkyGradient top={P.skyTop} mid={P.skyHorizon} bottom={P.earthDry1} grade={P.duskGold} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Hills y={H * 0.55} color={P.earthDry2} seed="h1" amp={80} />
        <Hills y={H * 0.62} color={'#7A4E1A'} seed="h2" amp={50} />
        <rect x={0} y={H * 0.70} width={W} height={H * 0.30} fill={P.earthDry1} />
        <DryGrass y={H * 0.88} count={100} frame={frame} seed="gg" />
      </svg>
      {/* uomo più grande */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.5},${H * 0.70})`}>
          <ManSilhouette x={0} y={0} scale={1.6} pose="stand" />
          <ellipse cx="0" cy="325" rx="60" ry="10" fill={P.inkDark} opacity={0.35} />
        </g>
      </svg>
      {/* thought bubble */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.5},${H * 0.30}) scale(${bubbleScale * pulse})`}>
          <defs>
            <radialGradient id="bubbleGlow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor={P.fireCore} stopOpacity="0.35" />
              <stop offset="100%" stopColor={P.fireCore} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="0" cy="0" r="480" fill="url(#bubbleGlow)" />
          {/* nuvola */}
          <path
            d="M -360 0 Q -400 -120 -280 -180 Q -260 -260 -130 -260 Q -80 -320 30 -310 Q 140 -330 220 -260 Q 330 -250 380 -170 Q 430 -100 380 -10 Q 420 80 320 130 Q 250 200 120 190 Q 30 230 -90 200 Q -200 210 -270 160 Q -380 130 -380 40 Q -410 -20 -360 0 Z"
            fill={P.petalWhite}
            stroke={P.smoke}
            strokeWidth="3"
          />
          {/* puntini */}
          <circle cx="-180" cy="260" r="22" fill={P.petalWhite} stroke={P.smoke} strokeWidth="2" />
          <circle cx="-230" cy="310" r="12" fill={P.petalWhite} stroke={P.smoke} strokeWidth="2" />
          {/* contenuto: file di ulivi + bimbo+nonno */}
          <g transform="translate(0, -40)">
            {/* cielo verde chiaro nel bubble */}
            <rect x="-330" y="-70" width="660" height="200" fill="#BEDFA0" opacity={0.8} />
            <rect x="-330" y="30" width="660" height="100" fill={P.grassGreen} opacity={0.6} />
            {/* ulivi ordinati */}
            {[-250, -150, -50, 50, 150, 250].map((x, i) => (
              <g key={i} transform={`translate(${x},30)`}>
                <rect x="-3" y="0" width="6" height="30" fill={P.oliveTrunk} />
                <ellipse cx="0" cy="-10" rx="28" ry="22" fill={P.oliveLeaf} />
                <ellipse cx="-8" cy="-18" rx="14" ry="12" fill={P.oliveLeafDark} opacity={0.8} />
              </g>
            ))}
            {/* bimbo + nonno */}
            <g transform="translate(-30, 60) scale(0.55)">
              <GrandpaSilhouette x={-40} y={0} scale={1} />
              <BoySilhouette x={40} y={20} scale={1} />
              {/* mani */}
              <line x1="-18" y1="135" x2="22" y2="155" stroke={P.manSkin} strokeWidth="5" strokeLinecap="round" />
            </g>
            {/* cuoricino */}
            <path
              d="M 0 -150 Q -12 -165 -24 -152 Q -30 -140 0 -115 Q 30 -140 24 -152 Q 12 -165 0 -150 Z"
              fill={P.duskMagenta}
              transform={`translate(140,-10) scale(${0.9 + Math.sin(frame * 0.2) * 0.1})`}
            />
          </g>
        </g>
      </svg>
      <Particles count={30} color={P.fireCore} size={[2, 4]} speed={[10, 30]} spread={{x: [0.15, 0.85], y: [0.15, 0.5]}} direction="drift" seed="dust2" glow life={140} />
      <ColorGrade tint={P.duskGold} opacity={0.1} />
      <Vignette strength={0.55} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 03 — Sigaretta accesa close-up
// ------------------------------------------------------------------
export const Shot03: React.FC = () => {
  const frame = useCurrentFrame();
  const flameScale = spring({frame: Math.max(0, frame - 10), fps: 30, config: {damping: 10, stiffness: 120}});
  return (
    <Camera duration={DUR} move={{from: {scale: 1.05}, to: {scale: 1.12}}}>
      <SkyGradient top={P.skyMid} mid="#8A2E1A" bottom="#3A1210" />
      {/* bokeh landscape background */}
      <AbsoluteFill style={{filter: 'blur(18px)'}}>
        <svg width={W} height={H} style={{position: 'absolute'}}>
          <Hills y={H * 0.55} color="#5A2E1A" seed="h1" amp={80} />
          <Hills y={H * 0.65} color="#3A1A10" seed="h2" amp={50} />
          {[...Array(15)].map((_, i) => (
            <circle key={i} cx={random('bk' + i) * W} cy={random('bky' + i) * H * 0.6 + 200} r={20 + random('bkr' + i) * 40} fill={P.fireMid} opacity={0.4} />
          ))}
        </svg>
      </AbsoluteFill>
      {/* uomo faccia 3/4 grande */}
      <svg width={W} height={H} style={{position: 'absolute'}} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <radialGradient id="faceGlow" cx="70%" cy="50%" r="50%">
            <stop offset="0%" stopColor={P.fireCore} stopOpacity="0.45" />
            <stop offset="100%" stopColor={P.fireCore} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#faceGlow)" />
        <g transform={`translate(${W * 0.40},${H * 0.58}) scale(3.8)`}>
          {/* testa */}
          <ellipse cx="0" cy="0" rx="60" ry="72" fill={P.manSkin} />
          {/* shading lato destro (luce da destra) */}
          <path d="M 20 -60 Q 60 -30 60 30 Q 40 70 0 72 Q -10 50 20 -60 Z" fill={P.manSkinShade} opacity={0.5} />
          {/* capelli */}
          <path d="M -55 -25 Q -45 -75 0 -72 Q 45 -75 55 -30 Q 45 -15 35 -10 Q 0 -30 -35 -10 Q -45 -15 -55 -25 Z" fill={P.inkDark} />
          {/* barba */}
          <ellipse cx="0" cy="55" rx="45" ry="18" fill={P.inkDark} opacity={0.35} />
          {/* occhi */}
          <ellipse cx="-18" cy="-5" rx="5" ry="3" fill={P.inkDark} />
          <ellipse cx="18" cy="-5" rx="5" ry="3" fill={P.inkDark} />
          <circle cx="-18" cy="-5" r="1.8" fill={P.fireCore} />
          <circle cx="18" cy="-5" r="1.8" fill={P.fireCore} />
          {/* naso */}
          <path d="M 0 -5 L -6 25 Q 0 32 6 25 Z" fill={P.manSkinShade} opacity={0.4} />
          {/* bocca */}
          <path d="M -12 45 Q 0 42 12 45 Q 15 50 10 54 Q 0 56 -10 54 Q -15 50 -12 45 Z" fill={P.manSkinShade} />
          {/* sigaretta tra labbra */}
          <g transform="translate(12, 50) rotate(-8)">
            <rect x="0" y="-2" width="55" height="5" fill={P.paperCream} />
            <rect x="48" y="-2" width="7" height="5" fill={P.fireDeep} />
            <circle cx="55" cy="0" r={3 + flameScale * 3} fill={P.fireCore} />
            <circle cx="55" cy="0" r={6 + flameScale * 4} fill={P.fireMid} opacity={0.6} />
          </g>
        </g>
      </svg>
      {/* smoke tendrils */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.72},${H * 0.50})`}>
          {[...Array(8)].map((_, i) => {
            const life = ((frame + i * 10) % 90) / 90;
            return (
              <circle
                key={i}
                cx={Math.sin(life * 4 + i) * 60 + (random('sm' + i) - 0.5) * 30}
                cy={-life * 500}
                r={20 + life * 60}
                fill={P.smokeLight}
                opacity={Math.sin(life * Math.PI) * 0.5}
              />
            );
          })}
        </g>
      </svg>
      <Particles count={15} color={P.emberGlow} size={[1, 3]} speed={[30, 80]} spread={{x: [0.55, 0.85], y: [0.5, 0.6]}} direction="up" seed="em3" glow life={80} />
      <ColorGrade tint={P.fireDeep} opacity={0.15} blend="multiply" />
      <Vignette strength={0.75} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 04 — Mozzicone cade nell'erba
// ------------------------------------------------------------------
export const Shot04: React.FC = () => {
  const frame = useCurrentFrame();
  const fall = interpolate(frame, [0, 40], [0, H * 0.58], {extrapolateRight: 'clamp'});
  const rot = interpolate(frame, [0, 40], [0, 180]);
  const impact = frame > 40 ? 1 : 0;
  const sparkScale = impact ? spring({frame: frame - 40, fps: 30, config: {damping: 8, stiffness: 150}}) : 0;
  return (
    <Camera duration={DUR} move={{from: {scale: 1.05}, to: {scale: 1.0}}}>
      <SkyGradient top="#E6732E" mid={P.grassDryDark} bottom={P.earthDry1} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {/* erba densa */}
        <rect x={0} y={H * 0.50} width={W} height={H * 0.50} fill={P.earthDry1} />
        <DryGrass y={H * 0.70} count={160} frame={frame} seed="ng1" scale={1.3} />
        <DryGrass y={H * 0.85} count={180} frame={frame + 10} seed="ng2" scale={1.5} />
        <DryGrass y={H * 0.95} count={140} frame={frame + 20} seed="ng3" scale={1.2} />
      </svg>
      {/* mozzicone che cade */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.52},${H * 0.18 + fall}) rotate(${rot})`}>
          <rect x="-25" y="-4" width="45" height="8" rx="4" fill={P.paperCream} />
          <rect x="15" y="-4" width="8" height="8" fill={P.fireDeep} />
          <circle cx="22" cy="0" r="4" fill={P.fireCore} />
          {/* trail di scintille */}
          {[...Array(6)].map((_, i) => (
            <circle key={i} cx={-6 - i * 3} cy={(random('t' + i) - 0.5) * 10} r={1.5} fill={P.emberGlow} opacity={0.7 - i * 0.1} />
          ))}
        </g>
      </svg>
      {/* flash impatto */}
      {impact > 0 && (
        <svg width={W} height={H} style={{position: 'absolute'}}>
          <g transform={`translate(${W * 0.52},${H * 0.78})`}>
            <circle r={40 * sparkScale} fill={P.fireCore} opacity={1 - sparkScale * 0.7} />
            <circle r={80 * sparkScale} fill={P.fireMid} opacity={(1 - sparkScale) * 0.5} />
            {[...Array(10)].map((_, i) => {
              const ang = (i / 10) * Math.PI * 2;
              const r = 60 * sparkScale;
              return (
                <line
                  key={i}
                  x1="0"
                  y1="0"
                  x2={Math.cos(ang) * r}
                  y2={Math.sin(ang) * r}
                  stroke={P.emberGlow}
                  strokeWidth="3"
                  opacity={1 - sparkScale * 0.8}
                />
              );
            })}
          </g>
        </svg>
      )}
      <Particles count={20} color={P.emberGlow} size={[1, 3]} speed={[30, 90]} spread={{x: [0.3, 0.7], y: [0.6, 0.9]}} direction="up" seed="em4" glow life={90} />
      <ColorGrade tint={P.fireMid} opacity={0.12} />
      <Vignette strength={0.6} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 05 — Fuoco parte + cavi alta tensione
// ------------------------------------------------------------------
export const Shot05: React.FC = () => {
  const frame = useCurrentFrame();
  const flameSpread = interpolate(frame, [0, 50], [0.2, 1], {extrapolateRight: 'clamp'});
  const cableSnap = frame > 45 ? 1 : 0;
  const spark = cableSnap ? spring({frame: frame - 45, fps: 30, config: {damping: 6, stiffness: 180}}) : 0;
  return (
    <Camera duration={DUR} move={{from: {scale: 1.15}, to: {scale: 1.0}}}>
      <SkyGradient top="#2A0A08" mid="#8A1A12" bottom="#E6521A" grade={P.fireMid} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Hills y={H * 0.55} color="#4A1410" seed="h1" amp={80} />
        <Hills y={H * 0.62} color="#3A0A08" seed="h2" amp={50} />
      </svg>
      {/* pylon tralicci */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[0.08, 0.38, 0.68].map((fx, i) => (
          <g key={i} transform={`translate(${fx * W},${H * 0.4})`}>
            <path d="M -25 0 L -10 -200 L 10 -200 L 25 0 Z M -25 -100 L 25 -100 M -20 -150 L 20 -150" stroke={P.inkDark} strokeWidth="3" fill="none" />
            <line x1="-50" y1="-180" x2="50" y2="-180" stroke={P.inkDark} strokeWidth="4" />
          </g>
        ))}
        {/* cavi */}
        <path d={`M ${0.08 * W} ${H * 0.4 - 180} Q ${0.23 * W} ${H * 0.4 - 160 + (cableSnap ? 40 : 0)} ${0.38 * W} ${H * 0.4 - 180}`} stroke={P.inkDark} strokeWidth="3" fill="none" />
        <path d={`M ${0.38 * W} ${H * 0.4 - 180} Q ${0.53 * W} ${H * 0.4 - 140 + (cableSnap ? 100 : 0)} ${0.68 * W} ${H * 0.4 - 180}`} stroke={P.inkDark} strokeWidth="3" fill="none" />
      </svg>
      {/* terra in fiamme */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={0} y={H * 0.62} width={W} height={H * 0.38} fill={P.earthDry2} />
        <DryGrass y={H * 0.95} count={120} frame={frame} seed="fg" scale={1.1} />
      </svg>
      {/* fiamme che si diffondono */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[...Array(8)].map((_, i) => {
          const x = (i / 8) * W + W * 0.05;
          const scale = 0.6 + random('fs' + i) * 0.6 + flameSpread * 0.4;
          const visible = (i / 8) < flameSpread;
          return visible ? <Flame key={i} x={x} y={H * 0.78} scale={scale} frame={frame + i * 3} seed={'f' + i} /> : null;
        })}
      </svg>
      {/* scintille cavo */}
      {spark > 0 && (
        <svg width={W} height={H} style={{position: 'absolute'}}>
          <g transform={`translate(${W * 0.53},${H * 0.4 - 60})`}>
            <circle r={30 * spark} fill={P.sparkWhite} opacity={1 - spark * 0.5} />
            {[...Array(12)].map((_, i) => {
              const ang = (i / 12) * Math.PI * 2;
              const r = 80 * spark;
              return (
                <line key={i} x1="0" y1="0" x2={Math.cos(ang) * r} y2={Math.sin(ang) * r} stroke={P.sparkBlue} strokeWidth="3" opacity={1 - spark} />
              );
            })}
          </g>
        </svg>
      )}
      {/* fumo */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <SmokePlume x={W * 0.3} y={H * 0.72} frame={frame} scale={0.8} seed="sm5a" />
        <SmokePlume x={W * 0.65} y={H * 0.72} frame={frame + 20} scale={1.1} seed="sm5b" />
      </svg>
      <Particles count={80} color={P.emberGlow} size={[1, 4]} speed={[80, 200]} spread={{x: [0, 1], y: [0.6, 0.95]}} direction="up" seed="em5" glow life={80} />
      <ColorGrade tint={P.fireDeep} opacity={0.2} blend="multiply" />
      <Vignette strength={0.7} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 06 — Casa in fiamme, persone e animali in fuga
// ------------------------------------------------------------------
export const Shot06: React.FC = () => {
  const frame = useCurrentFrame();
  const pan = interpolate(frame, [0, DUR], [30, -30]);
  const run = (speed: number, off: number) => ((frame * speed + off) % (W + 400)) - 200;
  return (
    <Camera duration={DUR} move={{from: {scale: 1.05, x: pan}, to: {scale: 1.1, x: -pan}}}>
      <SkyGradient top="#1A0604" mid="#6B1010" bottom="#E6421A" grade={P.fireMid} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Hills y={H * 0.50} color="#3A0A06" seed="h1" amp={70} />
      </svg>
      {/* casa in pietra */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.52},${H * 0.52})`}>
          {/* corpo casa */}
          <rect x="-180" y="0" width="360" height="240" fill="#8A6D4A" />
          <rect x="-180" y="0" width="360" height="240" fill="url(#stoneTexture)" />
          {/* shading lato destro */}
          <rect x="90" y="0" width="90" height="240" fill={P.inkDark} opacity={0.25} />
          {/* tetto */}
          <path d="M -210 0 L 0 -160 L 210 0 Z" fill="#5A2A1A" />
          <path d="M -210 0 L 0 -160 L 210 0 Z" fill={P.fireDeep} opacity={0.6} />
          {/* finestre illuminate */}
          <rect x="-130" y="60" width="60" height="80" fill={P.fireCore} />
          <rect x="70" y="60" width="60" height="80" fill={P.fireCore} />
          <rect x="-40" y="140" width="80" height="100" fill={P.inkDark} />
          <rect x="-40" y="140" width="80" height="100" fill={P.fireMid} opacity={0.7} />
          {/* mattoni dettaglio */}
          {[0, 1, 2].map((r) => (
            <line key={r} x1="-180" y1={30 + r * 60} x2="180" y2={30 + r * 60} stroke={P.inkDark} strokeWidth="1" opacity={0.3} />
          ))}
        </g>
      </svg>
      {/* fiamme sul tetto */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[-120, -40, 40, 120].map((dx, i) => (
          <Flame key={i} x={W * 0.52 + dx} y={H * 0.52 - 10} scale={1 + Math.sin(frame * 0.2 + i) * 0.1} frame={frame + i * 4} seed={'fh' + i} />
        ))}
      </svg>
      {/* fumo grande */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <SmokePlume x={W * 0.52} y={H * 0.4} frame={frame} scale={1.5} seed="sm6" />
      </svg>
      {/* persone in fuga (silhouette semplificate) */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${run(7, 0)},${H * 0.82})`}>
          <path d="M 0 0 L -5 -40 L -5 -70 L 5 -70 L 10 -40 L 5 0 Z M -5 -80 A 10 12 0 1 1 5 -80 A 10 12 0 1 1 -5 -80" fill={P.inkDark} />
          <path d="M -6 -60 L -15 -30" stroke={P.inkDark} strokeWidth="3" />
          <path d="M 6 -60 L 18 -38" stroke={P.inkDark} strokeWidth="3" />
        </g>
        <g transform={`translate(${run(9, 200)},${H * 0.86})`}>
          <path d="M 0 0 L -5 -35 L -5 -65 L 5 -65 L 10 -35 L 5 0 Z M -5 -75 A 9 11 0 1 1 5 -75 A 9 11 0 1 1 -5 -75" fill={P.inkDark} />
        </g>
        {/* cane */}
        <g transform={`translate(${run(11, 500)},${H * 0.90})`}>
          <ellipse cx="0" cy="0" rx="26" ry="10" fill={P.inkDark} />
          <rect x="-20" y="0" width="4" height="14" fill={P.inkDark} />
          <rect x="18" y="0" width="4" height="14" fill={P.inkDark} />
          <circle cx="24" cy="-6" r="8" fill={P.inkDark} />
          <path d="M -26 -2 L -32 -12" stroke={P.inkDark} strokeWidth="3" />
        </g>
        {/* cervo che salta */}
        <g transform={`translate(${run(8, 700)},${H * 0.78})`}>
          <ellipse cx="0" cy="0" rx="30" ry="12" fill="#5A3E22" />
          <rect x="-20" y="-2" width="4" height="20" fill="#5A3E22" />
          <rect x="18" y="-2" width="4" height="20" fill="#5A3E22" />
          <path d="M 24 -4 L 34 -24 L 28 -14 Z" fill="#5A3E22" />
          <path d="M 30 -20 L 36 -32 M 30 -20 L 42 -26" stroke="#5A3E22" strokeWidth="2" />
        </g>
      </svg>
      <Particles count={90} color={P.emberGlow} size={[1, 4]} speed={[60, 180]} spread={{x: [0, 1], y: [0.5, 1]}} direction="up" seed="em6" glow life={90} />
      <ColorGrade tint={P.fireDeep} opacity={0.18} />
      <Vignette strength={0.7} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 07 — Carabinieri alla porta
// ------------------------------------------------------------------
export const Shot07: React.FC = () => {
  const frame = useCurrentFrame();
  const doorOpen = interpolate(frame, [10, 40], [0, 40], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <Camera duration={DUR} move={{from: {scale: 1.02}, to: {scale: 1.1}}}>
      <SkyGradient top="#0A1020" mid="#2A2240" bottom="#4A2A30" grade="#E65A2E" />
      {/* casa di campagna esterno notte */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {/* distant glow incendio */}
        <ellipse cx={W * 0.85} cy={H * 0.6} rx={400} ry={200} fill={P.fireMid} opacity={0.35} />
        <rect x={0} y={H * 0.65} width={W} height={H * 0.35} fill="#2A1A14" />
        {/* facciata */}
        <rect x={W * 0.15} y={H * 0.25} width={W * 0.70} height={H * 0.60} fill="#6B5040" />
        <path d={`M ${W * 0.10} ${H * 0.30} L ${W * 0.50} ${H * 0.08} L ${W * 0.90} ${H * 0.30} Z`} fill="#3A2418" />
        {/* porta frame */}
        <rect x={W * 0.35} y={H * 0.40} width={W * 0.30} height={H * 0.45} fill={P.woodDark} />
        {/* warm interior light quando porta apre */}
        <rect x={W * 0.38} y={H * 0.43} width={W * 0.24} height={H * 0.40} fill={P.fireCore} opacity={doorOpen > 0 ? 0.9 : 0} />
        {/* porta (si restringe come vista in prospettiva mentre si apre) */}
        <g transform={`translate(${W * 0.35},${H * 0.40})`}>
          <rect x="0" y="0" width={Math.max(10, W * 0.30 - doorOpen * 6)} height={H * 0.45} fill={P.woodMid} />
          <rect x={Math.max(10, W * 0.30 - doorOpen * 6) - 24} y={H * 0.22} width="10" height="10" fill={P.brass} />
        </g>
        {/* sagoma uomo nella porta */}
        {doorOpen > 20 && (
          <g transform={`translate(${W * 0.50},${H * 0.58})`} opacity={(doorOpen - 20) / 20}>
            <ManSilhouette x={0} y={0} scale={1.1} pose="stand" />
          </g>
        )}
      </svg>
      {/* Carabinieri in foreground */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[0.32, 0.68].map((fx, i) => (
          <g key={i} transform={`translate(${W * fx},${H * 0.90}) scale(${i === 0 ? 1 : -1}, 1)`}>
            {/* gambe pantalone nero con striscia rossa */}
            <rect x="-22" y="-280" width="18" height="280" fill="#1C1826" />
            <rect x="4" y="-280" width="18" height="280" fill="#1C1826" />
            <rect x="-4" y="-280" width="3" height="280" fill={P.velvetRed} />
            <rect x="22" y="-280" width="3" height="280" fill={P.velvetRed} />
            {/* stivali */}
            <ellipse cx="-13" cy="0" rx="14" ry="6" fill={P.inkDark} />
            <ellipse cx="13" cy="0" rx="14" ry="6" fill={P.inkDark} />
            {/* giacca */}
            <path d="M -48 -460 Q -52 -320 -32 -280 L 32 -280 Q 52 -320 48 -460 Q 40 -500 0 -505 Q -40 -500 -48 -460 Z" fill="#1C1826" />
            {/* bottoni */}
            <circle cx="0" cy="-440" r="3" fill={P.brass} />
            <circle cx="0" cy="-410" r="3" fill={P.brass} />
            <circle cx="0" cy="-380" r="3" fill={P.brass} />
            <circle cx="0" cy="-350" r="3" fill={P.brass} />
            {/* collo rosso */}
            <path d="M -14 -510 L 14 -510 L 10 -495 L -10 -495 Z" fill={P.velvetRed} />
            {/* testa */}
            <ellipse cx="0" cy="-540" rx="22" ry="26" fill={P.manSkin} />
            {/* cappello bicornuto carabinieri */}
            <path d="M -35 -565 Q -30 -590 0 -590 Q 30 -590 35 -565 L 28 -560 L -28 -560 Z" fill="#1C1826" />
            <path d="M -35 -565 Q -30 -590 0 -590 Q 30 -590 35 -565 L 28 -560 L -28 -560 Z" stroke={P.brass} strokeWidth="2" fill="none" />
            {/* stemma */}
            <circle cx="0" cy="-574" r="5" fill={P.brass} />
            {/* volto accennato */}
            <circle cx="-7" cy="-540" r="1.5" fill={P.inkDark} />
            <circle cx="7" cy="-540" r="1.5" fill={P.inkDark} />
          </g>
        ))}
      </svg>
      <Particles count={15} color={P.fireMid} size={[1, 3]} speed={[20, 40]} spread={{x: [0.6, 1], y: [0.5, 0.8]}} direction="up" seed="em7" glow life={100} />
      <ColorGrade tint="#4A1A10" opacity={0.12} />
      <Vignette strength={0.7} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 08 — Elicottero vigili del fuoco
// ------------------------------------------------------------------
export const Shot08: React.FC = () => {
  const frame = useCurrentFrame();
  const heliX = interpolate(frame, [0, DUR], [-200, 400]);
  const rotorPhase = frame * 1.2;
  return (
    <Camera duration={DUR} move={{from: {scale: 1, x: -20}, to: {scale: 1.05, x: 20}}}>
      <SkyGradient top="#1A0A10" mid="#3A1512" bottom="#B23A1A" grade={P.fireMid} />
      {/* glow incendio basso */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <ellipse cx={W * 0.50} cy={H * 0.95} rx={800} ry={200} fill={P.fireMid} opacity={0.55} />
        <rect x={0} y={H * 0.78} width={W} height={H * 0.22} fill="#2A0808" />
        {/* terreno annerito con residui di fiamme */}
        {[0.1, 0.3, 0.55, 0.8].map((fx, i) => (
          <Flame key={i} x={W * fx} y={H * 0.95} scale={0.5} frame={frame + i * 6} seed={'fb' + i} />
        ))}
      </svg>
      {/* elicottero */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.3 + heliX},${H * 0.35})`}>
          {/* ombra */}
          <ellipse cx={0} cy={H * 0.55} rx={80} ry={10} fill={P.inkDark} opacity={0.3} />
          {/* corpo */}
          <path d="M -100 -10 Q -110 -50 -60 -60 L 60 -60 Q 110 -50 100 -10 Q 110 20 60 30 L -60 30 Q -110 20 -100 -10 Z" fill={P.fireDeep} />
          <path d="M -110 -10 L -100 -10 L -100 20 L -110 20 Z" fill={P.inkDark} />
          {/* finestrino */}
          <path d="M 40 -50 Q 90 -40 90 -10 L 40 -10 Z" fill={P.sparkBlue} opacity={0.7} />
          {/* coda */}
          <path d="M -100 -5 L -280 10 L -260 20 L -100 15 Z" fill={P.fireDeep} />
          <rect x="-280" y="-10" width="30" height="40" fill={P.fireDeep} />
          <path d="M -275 -5 L -295 -25 L -280 -10 Z" fill={P.fireDeep} />
          {/* pattini */}
          <rect x="-80" y="40" width="160" height="4" fill={P.inkDark} />
          <line x1="-60" y1="30" x2="-60" y2="40" stroke={P.inkDark} strokeWidth="3" />
          <line x1="60" y1="30" x2="60" y2="40" stroke={P.inkDark} strokeWidth="3" />
          {/* benna acqua */}
          <line x1="0" y1="40" x2="0" y2="90" stroke={P.inkDark} strokeWidth="2" />
          <path d="M -30 90 L 30 90 L 25 130 L -25 130 Z" fill="#D49030" />
          {/* rotore principale (blurred via rotazione rapida multipla, centrato su 0,-70) */}
          {[0, 60, 120].map((a, i) => (
            <rect
              key={i}
              x="-180"
              y="-72"
              width="360"
              height="4"
              fill={P.inkDark}
              opacity={0.35}
              transform={`rotate(${rotorPhase + a} 0 -70)`}
            />
          ))}
          <ellipse cx="0" cy="-70" rx="180" ry="8" fill={P.inkDark} opacity={0.15} />
          <circle cx="0" cy="-70" r="8" fill={P.inkDark} />
          {/* rotore coda */}
          {[0, 90].map((a, i) => (
            <rect
              key={i}
              x="-285"
              y="-11"
              width="20"
              height="2"
              fill={P.inkDark}
              opacity={0.35}
              transform={`rotate(${rotorPhase * 2 + a} -275 -10)`}
            />
          ))}
          {/* spotlight */}
          <defs>
            <linearGradient id="spot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={P.fireCore} stopOpacity="0.6" />
              <stop offset="100%" stopColor={P.fireCore} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 0 30 L -120 400 L 120 400 Z" fill="url(#spot)" />
        </g>
      </svg>
      {/* fumo residuo */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <SmokePlume x={W * 0.2} y={H * 0.85} frame={frame} scale={1.0} seed="sm8a" />
        <SmokePlume x={W * 0.75} y={H * 0.88} frame={frame + 30} scale={0.9} seed="sm8b" />
      </svg>
      <Particles count={60} color={P.emberGlow} size={[1, 3]} speed={[40, 120]} spread={{x: [0, 1], y: [0.7, 1]}} direction="up" seed="em8" glow life={100} />
      <ColorGrade tint={P.fireDeep} opacity={0.15} />
      <Vignette strength={0.7} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 09 — Tribunale, giudice + martelletto
// ------------------------------------------------------------------
export const Shot09: React.FC = () => {
  const frame = useCurrentFrame();
  const gavelRise = interpolate(frame, [0, 50], [0, -80], {extrapolateRight: 'clamp'});
  const gavelRot = interpolate(frame, [0, 50], [0, -40], {extrapolateRight: 'clamp'});
  return (
    <Camera duration={DUR} move={{from: {scale: 1.1, y: 20}, to: {scale: 1.0, y: 0}}}>
      <SkyGradient top="#1A0F08" mid="#3A1F10" bottom="#2A160A" />
      {/* aula tribunale - pannelli legno */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={0} y={0} width={W} height={H} fill={P.woodDark} />
        {/* raggi luce dalla finestra */}
        <defs>
          <linearGradient id="lightRay" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor={P.fireCore} stopOpacity="0.5" />
            <stop offset="100%" stopColor={P.fireCore} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`100,0 ${W * 0.5},${H} 0,${H} 0,0`} fill="url(#lightRay)" opacity={0.5} />
        {/* pannelli legno verticali */}
        {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((fx, i) => (
          <rect key={i} x={W * fx} y={0} width={4} height={H * 0.7} fill={P.inkDark} opacity={0.4} />
        ))}
        {/* tende rosse */}
        <path d={`M 0 0 Q ${W * 0.1} ${H * 0.3} 0 ${H * 0.5} Z`} fill={P.velvetRed} />
        <path d={`M ${W} 0 Q ${W * 0.9} ${H * 0.3} ${W} ${H * 0.5} Z`} fill={P.velvetRed} />
      </svg>
      {/* banco giudice */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={W * 0.10} y={H * 0.55} width={W * 0.80} height={H * 0.45} fill={P.woodMid} />
        <rect x={W * 0.10} y={H * 0.55} width={W * 0.80} height={20} fill={P.woodDark} />
        {/* intarsi */}
        <rect x={W * 0.15} y={H * 0.65} width={W * 0.20} height={H * 0.25} fill={P.woodDark} opacity={0.5} />
        <rect x={W * 0.65} y={H * 0.65} width={W * 0.20} height={H * 0.25} fill={P.woodDark} opacity={0.5} />
        {/* stemma centrale ottone */}
        <circle cx={W * 0.50} cy={H * 0.78} r={50} fill={P.brass} />
        <circle cx={W * 0.50} cy={H * 0.78} r={50} fill={P.inkDark} opacity={0.2} />
        <text x={W * 0.50} y={H * 0.795} fontSize={40} textAnchor="middle" fill={P.inkDark} fontFamily="serif" fontWeight="bold">⚖</text>
      </svg>
      {/* giudice */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.50},${H * 0.50})`}>
          {/* busto veste nera */}
          <path d="M -160 0 Q -180 180 -100 220 L 100 220 Q 180 180 160 0 Q 140 -20 0 -25 Q -140 -20 -160 0 Z" fill="#0A0808" />
          {/* jabot bianco */}
          <path d="M -30 -20 L 30 -20 L 20 60 L -20 60 Z" fill={P.petalWhite} />
          <path d="M -22 -10 L 22 -10 L 18 0 L -18 0 Z" fill={P.stoneCream} />
          <path d="M -18 10 L 18 10 L 14 25 L -14 25 Z" fill={P.stoneCream} />
          <path d="M -14 35 L 14 35 L 10 50 L -10 50 Z" fill={P.stoneCream} />
          {/* testa */}
          <ellipse cx="0" cy="-70" rx="40" ry="48" fill={P.manSkin} />
          <path d="M -30 -100 Q -20 -120 0 -118 Q 20 -120 30 -100 Q 25 -80 0 -85 Q -25 -80 -30 -100 Z" fill={P.grandpaHair} />
          {/* occhi severi */}
          <rect x="-20" y="-72" width="12" height="3" fill={P.inkDark} />
          <rect x="8" y="-72" width="12" height="3" fill={P.inkDark} />
          {/* bocca */}
          <path d="M -10 -50 L 10 -50" stroke={P.inkDark} strokeWidth="2" />
          {/* braccio destro che regge gavel */}
          <g transform={`translate(80, -20) rotate(${gavelRot})`}>
            <path d="M 0 0 Q 10 50 40 80" stroke="#0A0808" strokeWidth="40" strokeLinecap="round" fill="none" />
            <circle cx={40} cy={80} r={15} fill={P.manSkin} />
            {/* gavel */}
            <g transform={`translate(40,${80 + gavelRise})`}>
              <rect x="-8" y="-5" width="80" height="10" fill={P.woodDark} />
              <rect x="60" y="-20" width="40" height="40" rx="4" fill={P.woodMid} />
              <rect x="60" y="-20" width="40" height="40" rx="4" fill={P.inkDark} opacity={0.3} />
            </g>
          </g>
          <g transform="translate(-80, -20)">
            <path d="M 0 0 Q -20 40 -50 60" stroke="#0A0808" strokeWidth="40" strokeLinecap="round" fill="none" />
            <circle cx={-50} cy={60} r={15} fill={P.manSkin} />
          </g>
        </g>
      </svg>
      <Particles count={20} color={P.paperCream} size={[1, 3]} speed={[10, 30]} spread={{x: [0, 1], y: [0, 0.8]}} direction="drift" seed="dust9" life={150} blur={1} />
      <ColorGrade tint={P.duskGold} opacity={0.12} />
      <Vignette strength={0.7} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 10 — Close-up verbale + timbro RESPONSABILITÀ PENALE
// ------------------------------------------------------------------
export const Shot10: React.FC = () => {
  const frame = useCurrentFrame();
  // Timbro cade tra frame 35 e 42 con impatto
  const stampY = interpolate(frame, [0, 35, 42], [-200, -20, 30], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const stampScale = interpolate(frame, [0, 35, 42, 55], [1.5, 1.1, 1.5, 1.3], {extrapolateRight: 'clamp'});
  const stampRot = interpolate(frame, [0, 35, 42], [-18, -8, -6]);
  const impactFlash = frame >= 42 && frame <= 50 ? 1 - (frame - 42) / 8 : 0;
  const shake = frame >= 42 && frame <= 55 ? Math.sin(frame * 2) * ((55 - frame) / 13) * 8 : 0;
  return (
    <Camera duration={DUR} move={{from: {scale: 1.0}, to: {scale: 1.05}}}>
      <SkyGradient top={P.woodDark} mid={P.woodMid} bottom={P.woodDark} />
      {/* texture legno */}
      <svg width={W} height={H} style={{position: 'absolute', opacity: 0.3}}>
        {[...Array(20)].map((_, i) => (
          <line key={i} x1={0} y1={random('w' + i) * H} x2={W} y2={random('w' + i) * H + (random('w2' + i) - 0.5) * 20} stroke={P.inkDark} strokeWidth={1} opacity={0.4} />
        ))}
      </svg>
      {/* foglio */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.50 + shake},${H * 0.50}) rotate(-4)`}>
          <rect x={-380} y={-560} width={760} height={1120} fill={P.paperCream} />
          {/* shading */}
          <rect x={-380} y={-560} width={760} height={1120} fill="url(#paperShade)" opacity={0.3} />
          <defs>
            <linearGradient id="paperShade" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={P.inkDark} stopOpacity="0" />
              <stop offset="100%" stopColor={P.inkDark} stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* intestazione */}
          <text x={0} y={-480} fontSize={38} textAnchor="middle" fontFamily="Georgia, serif" fill={P.inkDark} fontWeight="bold">TRIBUNALE DI</text>
          <text x={0} y={-430} fontSize={34} textAnchor="middle" fontFamily="Georgia, serif" fill={P.inkDark}>VERBALE DI UDIENZA</text>
          <line x1={-300} y1={-400} x2={300} y2={-400} stroke={P.inkDark} strokeWidth={2} />
          {/* righe di testo finte */}
          {[...Array(12)].map((_, i) => (
            <line key={i} x1={-320} y1={-340 + i * 28} x2={320 - random('ln' + i) * 120} y2={-340 + i * 28} stroke={P.inkDark} strokeWidth={1.5} opacity={0.5} />
          ))}
          {/* blocco titolo centrale */}
          <rect x={-320} y={40} width={640} height={120} fill={P.paperCream} stroke={P.inkDark} strokeWidth={3} />
          <text x={0} y={110} fontSize={56} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold" fill={P.inkDark}>RESPONSABILITÀ</text>
          <text x={0} y={155} fontSize={56} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold" fill={P.inkDark}>PENALE</text>
          {/* altre righe sotto */}
          {[...Array(6)].map((_, i) => (
            <line key={i} x1={-300} y1={230 + i * 28} x2={300 - random('ln2' + i) * 100} y2={230 + i * 28} stroke={P.inkDark} strokeWidth={1.5} opacity={0.5} />
          ))}
          {/* firma */}
          <path d="M 100 450 Q 150 420 200 440 Q 240 460 280 435" stroke={P.inkDark} strokeWidth={2} fill="none" />
        </g>
      </svg>
      {/* timbro rosso */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.50 + shake},${H * 0.50 + stampY}) rotate(${stampRot}) scale(${stampScale})`}>
          <circle r={160} fill="none" stroke={P.inkRed} strokeWidth={12} opacity={0.95} />
          <circle r={135} fill="none" stroke={P.inkRed} strokeWidth={6} opacity={0.9} />
          <text y={-30} fontSize={32} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold" fill={P.inkRed}>CONDANNATO</text>
          <text y={15} fontSize={22} textAnchor="middle" fontFamily="Georgia, serif" fill={P.inkRed}>ART. 423 BIS</text>
          <text y={55} fontSize={22} textAnchor="middle" fontFamily="Georgia, serif" fill={P.inkRed}>C.P.</text>
          {/* texture noise */}
          <rect x={-150} y={-150} width={300} height={300} fill={P.paperCream} opacity={0.15} />
        </g>
      </svg>
      {/* flash impatto */}
      {impactFlash > 0 && (
        <AbsoluteFill style={{background: P.paperCream, opacity: impactFlash * 0.6}} />
      )}
      <Particles count={30} color={P.paperCream} size={[1, 3]} speed={[20, 50]} spread={{x: [0.3, 0.7], y: [0.35, 0.65]}} direction="drift" seed="dust10" life={80} />
      <ColorGrade tint={P.duskGold} opacity={0.08} />
      <Vignette strength={0.65} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 11 — Cimitero sunset
// ------------------------------------------------------------------
export const Shot11: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Camera duration={DUR} move={{from: {scale: 1.08}, to: {scale: 1.0}}}>
      <SkyGradient top="#3A1030" mid={P.duskMagenta} bottom={P.duskGold} grade={P.duskGold} />
      {/* sole enorme */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <circle cx={W * 0.50} cy={H * 0.58} r={180} fill={P.fireCore} />
        <circle cx={W * 0.50} cy={H * 0.58} r={260} fill={P.duskGold} opacity={0.4} />
        <circle cx={W * 0.50} cy={H * 0.58} r={380} fill={P.duskGold} opacity={0.15} />
      </svg>
      {/* colline lontane */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Hills y={H * 0.66} color={'#3E1028'} seed="ch1" amp={40} />
      </svg>
      {/* cipressi silhouette */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[0.08, 0.18, 0.28, 0.78, 0.88, 0.95].map((fx, i) => (
          <g key={i} transform={`translate(${W * fx},${H * 0.70})`}>
            <ellipse cx={0} cy={-200} rx={40} ry={250} fill={P.cypressDark} />
            <ellipse cx={0} cy={-300} rx={28} ry={150} fill={P.cypressDark} />
            <rect x={-5} y={-40} width={10} height={40} fill={P.inkDark} />
          </g>
        ))}
      </svg>
      {/* terra cimitero */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={0} y={H * 0.70} width={W} height={H * 0.30} fill="#2A1814" />
        <path d={`M 0 ${H * 0.70} Q ${W * 0.5} ${H * 0.66} ${W} ${H * 0.70} L ${W} ${H * 0.75} L 0 ${H * 0.75} Z`} fill="#4A2A1E" opacity={0.6} />
      </svg>
      {/* lapidi */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[
          {x: 0.15, y: 0.80, s: 1, r: -6},
          {x: 0.78, y: 0.82, s: 1.1, r: 4},
          {x: 0.30, y: 0.88, s: 0.8, r: -3},
          {x: 0.65, y: 0.91, s: 0.9, r: 5},
        ].map((g, i) => (
          <g key={i} transform={`translate(${W * g.x},${H * g.y}) rotate(${g.r}) scale(${g.s})`}>
            <path d="M -50 0 Q -50 -100 0 -110 Q 50 -100 50 0 Z" fill={P.stoneCream} />
            <path d="M -50 0 Q -50 -100 0 -110 Q 50 -100 50 0 Z" fill={P.inkDark} opacity={0.15} />
            <line x1={-20} y1={-40} x2={20} y2={-40} stroke={P.inkDark} strokeWidth={2} opacity={0.5} />
            <line x1={-15} y1={-20} x2={15} y2={-20} stroke={P.inkDark} strokeWidth={2} opacity={0.5} />
          </g>
        ))}
        {/* lapide principale centrale con "NONNO" */}
        <g transform={`translate(${W * 0.50},${H * 0.85})`}>
          <path d="M -100 0 Q -100 -200 0 -220 Q 100 -200 100 0 Z" fill={P.stoneCream} />
          <path d="M -100 0 Q -100 -200 0 -220 Q 100 -200 100 0 Z" fill={P.inkDark} opacity={0.12} />
          <text x={0} y={-130} fontSize={48} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold" fill={P.inkDark}>NONNO</text>
          <line x1={-60} y1={-100} x2={60} y2={-100} stroke={P.inkDark} strokeWidth={2} />
          <text x={0} y={-60} fontSize={22} textAnchor="middle" fontFamily="Georgia, serif" fill={P.inkDark} opacity={0.7}>1934 — 2019</text>
          <path d="M -12 -30 L 12 -30 M 0 -42 L 0 -18" stroke={P.inkDark} strokeWidth={3} />
        </g>
      </svg>
      {/* uomo inginocchiato davanti alla lapide */}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${W * 0.50},${H * 0.88})`}>
          <ManSilhouette x={0} y={0} scale={0.7} pose="kneel" />
          {/* bouquet */}
          <g transform="translate(0,-10)">
            {[-20, -10, 0, 10, 20].map((dx, i) => (
              <g key={i} transform={`translate(${dx}, ${Math.sin(i) * 3})`}>
                <circle cx={0} cy={0} r={6} fill={P.petalWhite} />
                <circle cx={0} cy={0} r={2} fill={P.duskGold} />
              </g>
            ))}
            <path d="M 0 5 L 0 25" stroke={P.oliveLeafDark} strokeWidth={2} />
          </g>
        </g>
      </svg>
      {/* god rays */}
      <svg width={W} height={H} style={{position: 'absolute', opacity: 0.35}}>
        <defs>
          <linearGradient id="ray" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor={P.fireCore} stopOpacity="0.0" />
            <stop offset="50%" stopColor={P.fireCore} stopOpacity="0.5" />
            <stop offset="100%" stopColor={P.fireCore} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points={`${W * 0.5},${H * 0.58} ${W * 0.2},${H} ${W * 0.8},${H}`} fill="url(#ray)" />
      </svg>
      <Particles count={30} color={P.fireCore} size={[2, 4]} speed={[10, 25]} spread={{x: [0, 1], y: [0.3, 0.8]}} direction="drift" seed="dust11" glow life={150} />
      <ColorGrade tint={P.duskMagenta} opacity={0.1} />
      <Vignette strength={0.55} />
    </Camera>
  );
};

// ------------------------------------------------------------------
// SHOT 12 — Lacrima close-up + reveal logo Nooland
// ------------------------------------------------------------------
export const Shot12: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  // Prima metà: lacrima close-up. Dopo frame 35: reveal logo con wipe.
  const revealProgress = interpolate(frame, [30, 50], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const logoScale = spring({frame: Math.max(0, frame - 40), fps: 30, config: {damping: 14, stiffness: 110}});
  const tearY = interpolate(frame, [0, 35], [0, 120], {extrapolateRight: 'clamp'});
  const tearOpacity = interpolate(frame, [0, 10, 30, 36], [0, 1, 1, 0]);
  return (
    <AbsoluteFill>
      {/* Layer 1: lacrima close-up - visibile fino a reveal */}
      <AbsoluteFill style={{opacity: 1 - revealProgress}}>
        <Camera duration={DUR} move={{from: {scale: 1.2}, to: {scale: 1.05}}}>
          <SkyGradient top="#3A1030" mid={P.duskMagenta} bottom={P.duskGold} />
          {/* faccia grande */}
          <svg width={width} height={height} style={{position: 'absolute'}}>
            <g transform={`translate(${width * 0.5},${height * 0.55}) scale(6)`}>
              <ellipse cx="0" cy="0" rx="80" ry="90" fill={P.manSkin} />
              <path d="M 30 -60 Q 70 -20 70 50 Q 50 80 10 85 Q 0 50 30 -60 Z" fill={P.manSkinShade} opacity={0.4} />
              {/* capelli */}
              <path d="M -70 -30 Q -60 -90 0 -88 Q 60 -90 70 -35 Q 55 -15 40 -10 Q 0 -25 -40 -10 Q -55 -15 -70 -30 Z" fill={P.inkDark} />
              {/* occhio socchiuso */}
              <path d="M -30 -10 Q -20 -15 -5 -10" stroke={P.inkDark} strokeWidth="2" fill="none" />
              <path d="M 5 -10 Q 20 -15 30 -10" stroke={P.inkDark} strokeWidth="2" fill="none" />
              {/* sopracciglia tristi */}
              <path d="M -34 -22 Q -20 -18 -4 -22" stroke={P.inkDark} strokeWidth="3" fill="none" />
              <path d="M 4 -22 Q 20 -18 34 -22" stroke={P.inkDark} strokeWidth="3" fill="none" />
              {/* bocca mesta */}
              <path d="M -18 50 Q 0 42 18 50" stroke={P.inkDark} strokeWidth="3" fill="none" />
              {/* barba */}
              <ellipse cx="0" cy="65" rx="55" ry="18" fill={P.inkDark} opacity={0.35} />
              {/* lacrima */}
              <g transform={`translate(18, ${-5 + tearY / 6}) scale(1)`} opacity={tearOpacity}>
                <path d="M 0 -10 Q -7 0 -4 8 Q 0 12 4 8 Q 7 0 0 -10 Z" fill={P.sparkBlue} />
                <circle cx={-1.5} cy={-3} r={1.5} fill={P.petalWhite} opacity={0.8} />
              </g>
            </g>
          </svg>
          <ColorGrade tint={P.duskMagenta} opacity={0.12} />
          <Vignette strength={0.65} />
        </Camera>
      </AbsoluteFill>

      {/* Layer 2: logo reveal */}
      <AbsoluteFill style={{opacity: revealProgress}}>
        {/* golden warm background */}
        <AbsoluteFill>
          <svg width={width} height={height}>
            <defs>
              <radialGradient id="brandBg" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor={P.fireCore} />
                <stop offset="60%" stopColor={P.duskGold} />
                <stop offset="100%" stopColor="#5A3A10" />
              </radialGradient>
            </defs>
            <rect width={width} height={height} fill="url(#brandBg)" />
            {/* motif ulivi decorativi in silhouette ai lati */}
            <g opacity={0.25}>
              {[0.1, 0.9].map((fx, i) => (
                <g key={i} transform={`translate(${width * fx},${height * 0.8})`}>
                  <rect x={-4} y={-120} width={8} height={120} fill={P.oliveTrunk} />
                  <ellipse cx={0} cy={-140} rx={60} ry={50} fill={P.oliveLeafDark} />
                </g>
              ))}
            </g>
            {/* raggi godray */}
            <g opacity={0.25}>
              {[0, 60, 120, 180, 240, 300].map((a, i) => (
                <polygon
                  key={i}
                  points={`${width * 0.5},${height * 0.5} ${width * 0.5 + Math.cos((a * Math.PI) / 180) * 1200 - 80},${height * 0.5 + Math.sin((a * Math.PI) / 180) * 1200} ${width * 0.5 + Math.cos((a * Math.PI) / 180) * 1200 + 80},${height * 0.5 + Math.sin((a * Math.PI) / 180) * 1200}`}
                  fill={P.fireCore}
                  opacity={0.4}
                  transform={`rotate(${frame * 0.3} ${width * 0.5} ${height * 0.5})`}
                />
              ))}
            </g>
          </svg>
        </AbsoluteFill>
        {/* logo */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div style={{transform: `scale(${logoScale})`, textAlign: 'center'}}>
            <Img src={staticFile('logo.png')} style={{width: 780, height: 'auto', filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.35))'}} />
            <div
              style={{
                marginTop: 30,
                fontSize: 44,
                fontFamily: 'Georgia, serif',
                color: P.inkDark,
                letterSpacing: 2,
                fontWeight: 600,
                opacity: interpolate(frame, [52, 65], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              Il tuo terreno, protetto.
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 28,
                fontFamily: 'Georgia, serif',
                color: P.inkRed,
                letterSpacing: 6,
                fontWeight: 700,
                textTransform: 'uppercase',
                opacity: interpolate(frame, [58, 70], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              Zero stress.
            </div>
          </div>
        </AbsoluteFill>
        <Vignette strength={0.45} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
