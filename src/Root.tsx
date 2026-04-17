import {Composition} from 'remotion';
import {MainVideo} from './MainVideo';
import {MapVideo} from './MapVideo';
import meta from './meta.json';
import plan from './map-plan.json';

const FPS = 30;
const TAIL_SECONDS = 1;
const durationInFrames = Math.max(
  60,
  Math.ceil((meta.voiceoverDuration + TAIL_SECONDS) * FPS),
);
const mapDurationInFrames = Math.max(
  60,
  Math.ceil(((plan.duration || meta.voiceoverDuration) + TAIL_SECONDS) * FPS),
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={durationInFrames}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="MapVideo"
        component={MapVideo}
        durationInFrames={mapDurationInFrames}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
