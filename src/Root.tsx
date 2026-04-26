import {Composition} from 'remotion';
import {MainVideo} from './MainVideo';
import {MapVideo} from './MapVideo';
import {NoolandAd, TOTAL_FRAMES as NOOLAND_FRAMES, FPS as NOOLAND_FPS} from './nooland/NoolandAd';
import {
  MetaAiAd,
  META_AI_AD_DURATION_SECONDS,
  META_AI_AD_FPS,
  metaAiAdDefaultProps,
} from './MetaAiAd';
import {Seduzione, SEDUZIONE_DURATION_SECONDS, SEDUZIONE_FPS} from './Seduzione';
import {
  EdgeStory,
  EDGE_STORY_FPS,
  edgeStoryDefaultProps,
} from './EdgeStory';
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
      <Composition
        id="NoolandAd"
        component={NoolandAd}
        durationInFrames={NOOLAND_FRAMES}
        fps={NOOLAND_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="MetaAiAd"
        component={MetaAiAd}
        durationInFrames={META_AI_AD_DURATION_SECONDS * META_AI_AD_FPS}
        fps={META_AI_AD_FPS}
        width={1080}
        height={1920}
        defaultProps={metaAiAdDefaultProps}
      />
      <Composition
        id="Seduzione"
        component={Seduzione}
        durationInFrames={Math.ceil(SEDUZIONE_DURATION_SECONDS * SEDUZIONE_FPS)}
        fps={SEDUZIONE_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="EdgeStory"
        component={EdgeStory}
        durationInFrames={Math.ceil(
          edgeStoryDefaultProps.durationSeconds * EDGE_STORY_FPS,
        )}
        fps={EDGE_STORY_FPS}
        width={1080}
        height={1920}
        defaultProps={edgeStoryDefaultProps}
        calculateMetadata={({props}) => ({
          durationInFrames: Math.ceil(props.durationSeconds * EDGE_STORY_FPS),
        })}
      />
    </>
  );
};
