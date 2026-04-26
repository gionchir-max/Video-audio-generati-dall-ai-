import {AbsoluteFill, useCurrentFrame} from 'remotion';

// Noise grain via SVG turbulence — rigenerato per-frame per flicker organico.
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.08}) => {
  const frame = useCurrentFrame();
  const seed = (frame % 8) + 1;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        opacity,
      }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={`gr-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0.6 0"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#gr-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
