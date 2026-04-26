import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from 'remotion';
import {TopBanner} from './TopBanner';

export type EdgeStoryProps = {
  slug: string;
  bannerText: string;
  bannerSeconds: number;
  musicVolume: number;
  music: string | null;
  durationSeconds: number;
};

export const edgeStoryDefaultProps: EdgeStoryProps = {
  slug: 'demo',
  bannerText: 'TITOLO DEL VIDEO',
  bannerSeconds: 10,
  musicVolume: 0.15,
  music: 'music.mp3',
  durationSeconds: 60,
};

export const EDGE_STORY_FPS = 30;

export const EdgeStory: React.FC<EdgeStoryProps> = ({
  slug,
  bannerText,
  bannerSeconds,
  musicVolume,
  music,
}) => {
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(`videos/${slug}/bg.mp4`)}
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

      <Audio src={staticFile(`videos/${slug}/voiceover.mp3`)} />
      {music ? (
        <Audio src={staticFile(music)} volume={musicVolume} loop />
      ) : null}

      <TopBanner text={bannerText} durationInFrames={bannerSeconds * fps} />
    </AbsoluteFill>
  );
};
