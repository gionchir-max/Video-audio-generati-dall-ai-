import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from 'remotion';
import {TopBanner} from './TopBanner';

const BANNER_TEXT = 'GREENE: COME FARLA PENSARE A TE';
const BANNER_SECONDS = 10;

export const Seduzione: React.FC = () => {
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile('seduzione-bg.mp4')}
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <Audio src={staticFile('seduzione-vo.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.15} loop />

      <TopBanner text={BANNER_TEXT} durationInFrames={BANNER_SECONDS * fps} />
    </AbsoluteFill>
  );
};

export const SEDUZIONE_DURATION_SECONDS = 210;
export const SEDUZIONE_FPS = 30;
