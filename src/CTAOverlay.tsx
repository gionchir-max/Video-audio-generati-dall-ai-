import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type Props = {
  phone: string;
  site: string;
  durationSeconds?: number;
  tailSeconds?: number;
};

export const CTAOverlay: React.FC<Props> = ({
  phone,
  site,
  durationSeconds = 5.5,
  tailSeconds = 1,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const ctaFrames = Math.ceil(durationSeconds * fps);
  const tailFrames = Math.ceil(tailSeconds * fps);
  const startFrame = Math.max(0, durationInFrames - ctaFrames - tailFrames);

  if (frame < startFrame - 2) return null;

  const localFrame = frame - startFrame;

  const fadeIn = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const pop = spring({
    frame: localFrame,
    fps,
    config: {damping: 14, mass: 0.7, stiffness: 120},
  });

  const phoneBlink = Math.abs(Math.sin((localFrame / fps) * 2.4));
  const phoneShadow = 0.6 + 0.4 * phoneBlink;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: `rgba(0,0,0,${0.72 * fadeIn})`,
      }}
    >
      <div
        style={{
          opacity: fadeIn,
          transform: `scale(${0.82 + 0.18 * pop})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 44,
          padding: '0 60px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 48,
            padding: '54px 88px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Img
            src={staticFile('logo.png')}
            style={{width: 620, height: 'auto', display: 'block'}}
          />
        </div>

        <div
          style={{
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontWeight: 900,
            fontSize: 96,
            lineHeight: 1,
            color: 'white',
            letterSpacing: -2,
            textShadow: `0 6px 28px rgba(0,0,0,${phoneShadow})`,
          }}
        >
          {phone}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            backgroundColor: 'rgba(37,211,102,0.95)',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: -0.5,
            padding: '18px 40px',
            borderRadius: 60,
            boxShadow: '0 12px 38px rgba(0,0,0,0.5)',
          }}
        >
          WhatsApp · CHIAMA ORA
        </div>

        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 54,
            color: 'white',
            letterSpacing: -0.5,
            textShadow: '0 3px 14px rgba(0,0,0,0.85)',
          }}
        >
          {site}
        </div>
      </div>
    </AbsoluteFill>
  );
};
