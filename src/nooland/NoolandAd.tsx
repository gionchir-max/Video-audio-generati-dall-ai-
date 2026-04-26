import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {FPS, SHOT_FRAMES, TOTAL_FRAMES} from './palette';
import {Grain} from './components/Grain';
import {HookOverlay} from './components/HookOverlay';
import {
  Shot01, Shot02, Shot03, Shot04, Shot05, Shot06,
  Shot07, Shot08, Shot09, Shot10, Shot11, Shot12,
} from './shots';

const shots = [Shot01, Shot02, Shot03, Shot04, Shot05, Shot06, Shot07, Shot08, Shot09, Shot10, Shot11, Shot12];

export const NoolandAd: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {shots.map((Shot, i) => (
        <Sequence key={i} from={i * SHOT_FRAMES} durationInFrames={SHOT_FRAMES}>
          <Shot />
        </Sequence>
      ))}
      {/* Grano film globale */}
      <Grain opacity={0.06} />
      {/* Hook prepotente sui primi 3s */}
      <Sequence from={0} durationInFrames={90}>
        <HookOverlay />
      </Sequence>
      {/* Voice over */}
      <Audio src={staticFile('nooland/vo.mp3')} volume={1.15} />
    </AbsoluteFill>
  );
};

export {TOTAL_FRAMES, FPS};
