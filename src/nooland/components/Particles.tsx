import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';

type Props = {
  count: number;
  color: string;
  size?: [number, number];
  speed?: [number, number];
  life?: number;
  spread?: {x: [number, number]; y: [number, number]};
  direction?: 'up' | 'down' | 'drift';
  seed?: string;
  blur?: number;
  glow?: boolean;
};

export const Particles: React.FC<Props> = ({
  count,
  color,
  size = [2, 6],
  speed = [20, 80],
  life = 120,
  spread = {x: [0, 1], y: [0, 1]},
  direction = 'up',
  seed = 'p',
  blur = 0,
  glow = false,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const items = Array.from({length: count}).map((_, i) => {
    const s = `${seed}-${i}`;
    const baseX = random(`${s}-x`) * (spread.x[1] - spread.x[0]) + spread.x[0];
    const baseY = random(`${s}-y`) * (spread.y[1] - spread.y[0]) + spread.y[0];
    const sz = size[0] + random(`${s}-sz`) * (size[1] - size[0]);
    const sp = speed[0] + random(`${s}-sp`) * (speed[1] - speed[0]);
    const delay = random(`${s}-d`) * life;
    const local = ((frame + delay) % life) / life;
    const drift = Math.sin((frame + random(`${s}-ph`) * 100) * 0.05) * 20;
    const dirSign = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
    const yOff = dirSign * sp * local + (direction === 'drift' ? Math.sin(local * Math.PI * 2) * 40 : 0);
    const opacity = Math.sin(local * Math.PI);
    const x = baseX * width + drift;
    const y = baseY * height + yOff;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: sz,
          height: sz,
          borderRadius: '50%',
          background: color,
          opacity,
          filter: `${blur ? `blur(${blur}px) ` : ''}${glow ? `drop-shadow(0 0 ${sz * 2}px ${color})` : ''}`,
        }}
      />
    );
  });
  return <AbsoluteFill style={{pointerEvents: 'none'}}>{items}</AbsoluteFill>;
};
