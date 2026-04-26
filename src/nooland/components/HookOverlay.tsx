import React from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame} from 'remotion';
import {P} from '../palette';

// Hook prepotente: "€ 50.000" per una sigaretta.
// Visibile 0-75f (2.5s) + fade out fino 90f.
export const HookOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = spring({frame, fps: 30, config: {damping: 10, stiffness: 180, mass: 0.9}});
  const shake = frame < 60 ? (random('s' + (frame >> 1)) - 0.5) * 14 : 0;
  const opacity = interpolate(frame, [0, 3, 60, 85], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bgOpacity = interpolate(frame, [0, 3, 60, 85], [0, 0.55, 0.55, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const subPulse = 1 + Math.sin(frame * 0.35) * 0.03;

  // Burn-stamp accent
  const burnAngle = Math.sin(frame * 0.2) * 3;

  return (
    <AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
      {/* dark tint */}
      <AbsoluteFill style={{background: 'rgba(0,0,0,1)', opacity: bgOpacity}} />

      {/* banconote bruciate decorative sullo sfondo */}
      <AbsoluteFill style={{opacity: bgOpacity * 0.9}}>
        <svg width="1080" height="1920">
          {[...Array(14)].map((_, i) => {
            const x = random('bn-x' + i) * 1080;
            const y = random('bn-y' + i) * 1920;
            const rot = (random('bn-r' + i) - 0.5) * 60;
            const scaleI = 0.6 + random('bn-s' + i) * 0.6;
            const fall = Math.sin(frame * 0.03 + i) * 20;
            return (
              <g key={i} transform={`translate(${x},${y + fall}) rotate(${rot}) scale(${scaleI})`}>
                <rect x={-80} y={-40} width={160} height={80} fill="#5A6B3A" rx={4} />
                <rect x={-80} y={-40} width={160} height={80} fill={P.inkDark} opacity={0.55} rx={4} />
                <circle cx={0} cy={0} r={22} fill="#6B8A4A" opacity={0.4} />
                <text x={-60} y={-20} fontSize={12} fill="#D9E6B2" opacity={0.5} fontFamily="Georgia, serif" fontWeight="bold">€</text>
                <text x={50} y={30} fontSize={12} fill="#D9E6B2" opacity={0.5} fontFamily="Georgia, serif" fontWeight="bold">€</text>
                {/* bordo bruciato */}
                <path d={`M -80 ${-40 + random('ed' + i) * 30} Q -70 ${-30 + random('ed2' + i) * 20} -80 40`} stroke="#0A0404" strokeWidth={14} fill="none" />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* overlay grid for dramatic vibe */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(194,41,26,0.4) 0%, rgba(0,0,0,0.85) 70%)',
          opacity: bgOpacity * 1.2,
        }}
      />

      {/* TESTO CENTRALE */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            transform: `translate(${shake}px, ${shake * 0.5}px) scale(${scale})`,
            textAlign: 'center',
            width: '100%',
          }}
        >
          {/* Etichetta top */}
          <div
            style={{
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 54,
              color: P.fireCore,
              letterSpacing: 10,
              marginBottom: 20,
              textShadow: '0 0 20px rgba(0,0,0,0.9)',
              WebkitTextStroke: `2px ${P.inkDark}`,
            }}
          >
            ATTENZIONE
          </div>

          {/* Cifra gigante */}
          <div
            style={{
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 360,
              color: P.fireCore,
              letterSpacing: -6,
              lineHeight: 0.95,
              fontWeight: 900,
              textShadow: `6px 6px 0 ${P.inkRed}, 12px 12px 0 ${P.inkDark}, 0 0 60px rgba(255,120,30,0.7)`,
              WebkitTextStroke: `4px ${P.inkDark}`,
              transform: `scale(${subPulse})`,
            }}
          >
            € 50.000
          </div>

          {/* Sottotitolo esplosivo */}
          <div
            style={{
              marginTop: 10,
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 76,
              color: P.petalWhite,
              letterSpacing: 3,
              textShadow: `4px 4px 0 ${P.inkDark}, 0 0 30px rgba(0,0,0,0.9)`,
              WebkitTextStroke: `2px ${P.inkDark}`,
              textTransform: 'uppercase',
            }}
          >
            di multa
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 46,
              color: P.fireMid,
              letterSpacing: 4,
              textShadow: `3px 3px 0 ${P.inkDark}`,
              WebkitTextStroke: `1.5px ${P.inkDark}`,
              textTransform: 'uppercase',
            }}
          >
            per una sola sigaretta
          </div>

          {/* timbro rosso rotante */}
          <div
            style={{
              marginTop: 40,
              display: 'inline-block',
              transform: `rotate(${-12 + burnAngle}deg)`,
              border: `6px solid ${P.inkRed}`,
              padding: '12px 34px',
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: 38,
              color: P.inkRed,
              letterSpacing: 4,
              background: 'rgba(255,255,255,0.05)',
              boxShadow: `0 0 20px ${P.inkRed}`,
            }}
          >
            STORIA VERA
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
