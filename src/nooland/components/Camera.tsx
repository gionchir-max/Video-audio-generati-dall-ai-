import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

type Move = {
  from: {scale?: number; x?: number; y?: number};
  to: {scale?: number; x?: number; y?: number};
};

export const Camera: React.FC<React.PropsWithChildren<{duration: number; move?: Move}>> = ({
  duration,
  move,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = (f: number) => frame / duration;
  const scale = move
    ? interpolate(frame, [0, duration], [move.from.scale ?? 1, move.to.scale ?? 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const x = move
    ? interpolate(frame, [0, duration], [move.from.x ?? 0, move.to.x ?? 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  const y = move
    ? interpolate(frame, [0, duration], [move.from.y ?? 0, move.to.y ?? 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  void t;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${scale}) translate(${x}px, ${y}px)`, transformOrigin: 'center center'}}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Fade-in/out wrapper per shot (smooth crossfade sintetico)
export const ShotFade: React.FC<React.PropsWithChildren<{duration: number; fadeFrames?: number}>> = ({
  duration,
  fadeFrames = 6,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, fadeFrames, duration - fadeFrames, duration],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};
