import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {CTAOverlay} from './CTAOverlay';

export type Caption = {
  text: string;
  fromSec: number;
  toSec: number;
  color?: string;
  size?: number;
};

export type MetaAiAdProps = {
  slug: string;
  hookText: string;
  hookSubtitle?: string;
  captions: Caption[];
  phone: string;
  site: string;
  ctaDurationSeconds?: number;
  geoTag?: string;
};

export const META_AI_AD_DURATION_SECONDS = 30;
export const META_AI_AD_FPS = 30;

export const metaAiAdDefaultProps: MetaAiAdProps = {
  slug: 'v13-fuori-sede-A',
  hookText: 'Vivo a Milano.',
  hookSubtitle: 'Il terreno è a Enna.',
  captions: [
    {text: 'Vivo a Milano.', fromSec: 0, toSec: 4.5, color: 'white', size: 110},
    {text: 'Il terreno è a Enna.', fromSec: 5, toSec: 9.5, color: 'white', size: 100},
    {text: 'Hai chiamato 5 persone.', fromSec: 10, toSec: 14, color: '#ffe066', size: 92},
    {text: 'Poi hai trovato Nooland.', fromSec: 15, toSec: 19, color: 'white', size: 96},
    {text: 'Foto · GPS · Fattura.', fromSec: 20, toSec: 24, color: '#7be07b', size: 90},
  ],
  phone: '375 870 7282',
  site: 'nooland.it',
  ctaDurationSeconds: 5.5,
  geoTag: 'Enna',
};

const HookOverlay: React.FC<{text: string; subtitle?: string; geoTag?: string}> = ({
  text,
  subtitle,
  geoTag,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [70, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const pop = spring({
    frame,
    fps,
    config: {damping: 14, mass: 0.6, stiffness: 130},
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 220,
        opacity,
      }}
    >
      {geoTag && (
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 36,
            color: '#ffe066',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 16,
            textShadow: '0 4px 18px rgba(0,0,0,0.85)',
            transform: `scale(${0.85 + 0.15 * pop})`,
          }}
        >
          {geoTag}
        </div>
      )}
      <div
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 900,
          fontSize: 120,
          lineHeight: 1.05,
          color: 'white',
          letterSpacing: -3,
          textAlign: 'center',
          padding: '0 60px',
          textShadow:
            '0 6px 28px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.9)',
          transform: `scale(${0.92 + 0.08 * pop})`,
        }}
      >
        {text}
      </div>
      {subtitle && (
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 800,
            fontSize: 88,
            lineHeight: 1.05,
            color: '#ffe066',
            letterSpacing: -2,
            textAlign: 'center',
            padding: '0 60px',
            marginTop: 18,
            textShadow:
              '0 6px 24px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.9)',
            transform: `scale(${0.92 + 0.08 * pop})`,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};

const CaptionBand: React.FC<{caption: Caption}> = ({caption}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const startFrame = Math.round(caption.fromSec * fps);
  const endFrame = Math.round(caption.toSec * fps);
  const fadeInEnd = startFrame + 8;
  const fadeOutStart = endFrame - 12;

  const fadeIn = interpolate(frame, [startFrame, fadeInEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [fadeOutStart, endFrame], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  if (frame < startFrame - 2 || frame > endFrame + 2) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 460,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 900,
          fontSize: caption.size ?? 92,
          lineHeight: 1.05,
          color: caption.color ?? 'white',
          letterSpacing: -2,
          textAlign: 'center',
          padding: '0 60px',
          textShadow:
            '0 6px 28px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.9)',
        }}
      >
        {caption.text}
      </div>
    </AbsoluteFill>
  );
};

export const MetaAiAd: React.FC<MetaAiAdProps> = ({
  slug,
  hookText,
  hookSubtitle,
  captions,
  phone,
  site,
  ctaDurationSeconds = 5.5,
  geoTag,
}) => {
  const cleanVideoPath = `nooland-campaign/${slug}/clean.mp4`;

  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(cleanVideoPath)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* Vignette inferiore per leggibilità caption */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Hook nei primi 3 secondi (90 frame @ 30fps) */}
      <Sequence from={0} durationInFrames={90}>
        <HookOverlay text={hookText} subtitle={hookSubtitle} geoTag={geoTag} />
      </Sequence>

      {/* Caption interne (band centrale) */}
      {captions.map((cap, i) => (
        <CaptionBand key={i} caption={cap} />
      ))}

      {/* CTA finale Nooland (riusa CTAOverlay esistente) */}
      <CTAOverlay
        phone={phone}
        site={site}
        durationSeconds={ctaDurationSeconds}
      />
    </AbsoluteFill>
  );
};
