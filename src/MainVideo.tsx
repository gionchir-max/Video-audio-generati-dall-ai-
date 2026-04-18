import {AbsoluteFill, Audio, OffthreadVideo, staticFile, useVideoConfig} from 'remotion';
import {Subtitles} from './Subtitles';
import {TopBanner} from './TopBanner';
import {SoundEffects} from './SoundEffects';
import {QuestionOverlay} from './QuestionOverlay';
import banner from './banner.json';

export const MainVideo: React.FC = () => {
  const {fps} = useVideoConfig();
  const bannerDurationFrames = 10 * fps;

  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile('bg.mp4')}
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
            'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <Audio src={staticFile('voiceover.mp3')} />
      <Audio src={staticFile('music.mp3')} volume={0.15} loop />

      <SoundEffects />

      <TopBanner text={banner.text} durationInFrames={bannerDurationFrames} />

      <QuestionOverlay />

      <Subtitles />
    </AbsoluteFill>
  );
};
