import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import openLoop from './open-loop.json';

// Overlay persistente con la "domanda open loop": appare dopo l'uscita del banner iniziale
// (≥10s) e resta a schermo fino a quando inizia la risposta nel payoff finale.
// Posizione: top ~22% — sotto il banner e sopra ai sottotitoli (a 48%), quindi mai sovrapposto.

export const QuestionOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  if (!openLoop.question || openLoop.end <= openLoop.start) return null;

  const BANNER_END = 10; // deve stare dopo il TopBanner
  const effectiveStart = Math.max(BANNER_END, openLoop.start);
  const effectiveEnd = openLoop.end;
  if (effectiveEnd <= effectiveStart) return null;

  if (t < effectiveStart - 0.3 || t > effectiveEnd + 0.3) return null;

  const fadeIn = interpolate(
    t,
    [effectiveStart, effectiveStart + 0.4],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const fadeOut = interpolate(
    t,
    [effectiveEnd - 0.35, effectiveEnd],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const slideY = interpolate(
    t,
    [effectiveStart, effectiveStart + 0.4],
    [-12, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 420,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${slideY}px)`,
          maxWidth: 860,
          padding: '14px 26px',
          borderRadius: 18,
          backgroundColor: 'rgba(0,0,0,0.55)',
          border: '2px solid rgba(255,215,0,0.7)',
          color: '#FFFFFF',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontWeight: 600,
          fontSize: 32,
          lineHeight: 1.22,
          textAlign: 'center',
          letterSpacing: '-0.005em',
          textShadow: '0 2px 6px rgba(0,0,0,0.85)',
          boxShadow: '0 10px 34px rgba(0,0,0,0.55)',
        }}
      >
        {openLoop.question}
      </div>
    </AbsoluteFill>
  );
};
