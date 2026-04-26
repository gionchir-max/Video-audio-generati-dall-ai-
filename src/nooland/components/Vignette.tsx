import {AbsoluteFill} from 'remotion';

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.55}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

export const ColorGrade: React.FC<{tint?: string; opacity?: number; blend?: React.CSSProperties['mixBlendMode']}> = ({
  tint = '#FF9A3A',
  opacity = 0.10,
  blend = 'soft-light',
}) => (
  <AbsoluteFill
    style={{pointerEvents: 'none', background: tint, opacity, mixBlendMode: blend}}
  />
);
