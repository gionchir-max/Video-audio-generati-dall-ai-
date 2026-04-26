import React from 'react';
import {P} from '../palette';

// Uomo adulto di spalle o 3/4 — silhouette stilizzata con shading piatto.
export const ManSilhouette: React.FC<{
  x: number;
  y: number;
  scale?: number;
  pose?: 'stand' | 'smoke' | 'kneel' | 'bow';
  flip?: boolean;
}> = ({x, y, scale = 1, pose = 'stand', flip}) => {
  return (
    <g transform={`translate(${x},${y}) scale(${scale}${flip ? ',' + scale : ''}) ${flip ? 'scale(-1,1)' : ''}`}>
      {/* Gamba */}
      <path
        d="M -25 170 Q -22 240 -30 310 L -10 310 Q -8 240 -5 170 Z"
        fill={P.manPants}
      />
      <path
        d="M 5 170 Q 8 240 2 310 L 22 310 Q 25 240 25 170 Z"
        fill={P.manPants}
      />
      {/* Stivali */}
      <ellipse cx="-20" cy="314" rx="14" ry="7" fill={P.inkDark} />
      <ellipse cx="12" cy="314" rx="14" ry="7" fill={P.inkDark} />
      {/* Torso/giacca */}
      <path
        d="M -45 70 Q -50 140 -35 175 L 35 175 Q 50 140 45 70 Q 35 35 0 30 Q -35 35 -45 70 Z"
        fill={P.manJacket}
      />
      <path
        d="M -42 85 L -20 90 L -18 170 L -38 165 Z"
        fill={P.manJacketShade}
        opacity={0.6}
      />
      {/* Collo + camicia V */}
      <path d="M -8 35 L 8 35 L 0 55 Z" fill={P.manShirt} />
      {/* Testa */}
      {pose === 'bow' || pose === 'kneel' ? (
        <g transform="translate(0,-4) rotate(15)">
          <ellipse cx="0" cy="10" rx="20" ry="24" fill={P.manSkin} />
          <path d="M -18 -2 Q -10 -18 0 -16 Q 10 -18 18 -2 Q 16 4 12 3 Q 0 -4 -12 3 Q -16 4 -18 -2 Z" fill={P.inkDark} opacity={0.75} />
        </g>
      ) : (
        <g>
          <ellipse cx="0" cy="5" rx="20" ry="24" fill={P.manSkin} />
          <path d="M -18 -7 Q -10 -22 0 -20 Q 10 -22 18 -7 Q 16 -1 12 -2 Q 0 -9 -12 -2 Q -16 -1 -18 -7 Z" fill={P.inkDark} opacity={0.8} />
          <circle cx="-6" cy="5" r="1.4" fill={P.inkDark} />
          <circle cx="7" cy="5" r="1.4" fill={P.inkDark} />
        </g>
      )}
      {/* Stoppie barba */}
      <ellipse cx="0" cy="22" rx="10" ry="5" fill={P.inkDark} opacity={0.25} />
      {/* Braccia */}
      {pose === 'smoke' ? (
        <g>
          <path d="M -45 80 Q -60 120 -48 155 L -40 150 Q -48 125 -38 95 Z" fill={P.manJacket} />
          <path d="M 40 80 Q 55 100 45 135 Q 40 150 30 150 L 28 142 Q 36 130 35 105 Z" fill={P.manJacket} />
          <circle cx="30" cy="148" r="6" fill={P.manSkin} />
          {/* sigaretta */}
          <rect x="32" y="142" width="26" height="3" fill={P.paperCream} />
          <rect x="56" y="142" width="6" height="3" fill={P.fireDeep} />
          <circle cx="60" cy="143" r="3" fill={P.fireCore} opacity={0.9} />
        </g>
      ) : pose === 'kneel' ? (
        <g>
          <path d="M -40 85 Q -30 140 -10 155 L -5 148 Q -22 140 -32 90 Z" fill={P.manJacket} />
          <path d="M 40 85 Q 30 140 10 155 L 5 148 Q 22 140 32 90 Z" fill={P.manJacket} />
        </g>
      ) : (
        <g>
          <path d="M -45 80 Q -55 140 -40 170 L -32 165 Q -42 140 -38 90 Z" fill={P.manJacket} />
          <path d="M 45 80 Q 55 140 40 170 L 32 165 Q 42 140 38 90 Z" fill={P.manJacket} />
        </g>
      )}
    </g>
  );
};

export const GrandpaSilhouette: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    {/* gambe */}
    <path d="M -20 140 L -22 230 L -8 230 L -6 140 Z" fill={P.manPants} />
    <path d="M 6 140 L 8 230 L 22 230 L 20 140 Z" fill={P.manPants} />
    <ellipse cx="-14" cy="234" rx="12" ry="6" fill={P.inkDark} />
    <ellipse cx="14" cy="234" rx="12" ry="6" fill={P.inkDark} />
    {/* gilet */}
    <path d="M -32 45 Q -38 120 -22 150 L 22 150 Q 38 120 32 45 Q 20 25 0 22 Q -20 25 -32 45 Z" fill="#5A3E22" />
    <path d="M -8 25 L 8 25 L 0 50 Z" fill={P.manShirt} />
    {/* testa */}
    <ellipse cx="0" cy="5" rx="17" ry="20" fill={P.manSkin} />
    {/* coppola */}
    <path d="M -20 -10 Q 0 -28 20 -10 L 22 -4 L 24 -3 L 24 2 L -22 2 Q -22 -5 -20 -10 Z" fill={P.grandpaCap} />
    {/* baffi bianchi */}
    <ellipse cx="0" cy="14" rx="10" ry="3" fill={P.grandpaHair} />
    <circle cx="-5" cy="6" r="1.2" fill={P.inkDark} />
    <circle cx="5" cy="6" r="1.2" fill={P.inkDark} />
  </g>
);

export const BoySilhouette: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`}>
    <path d="M -12 90 L -14 155 L -4 155 L -3 90 Z" fill="#2E4E7A" />
    <path d="M 3 90 L 4 155 L 14 155 L 12 90 Z" fill="#2E4E7A" />
    <ellipse cx="-9" cy="158" rx="8" ry="4" fill={P.inkDark} />
    <ellipse cx="9" cy="158" rx="8" ry="4" fill={P.inkDark} />
    <path d="M -22 30 Q -26 85 -15 105 L 15 105 Q 26 85 22 30 Q 12 15 0 12 Q -12 15 -22 30 Z" fill="#E65A2E" />
    <ellipse cx="0" cy="0" rx="15" ry="17" fill={P.manSkin} />
    <path d="M -15 -10 Q -8 -22 0 -20 Q 8 -22 15 -10 Q 14 -5 10 -6 Q 0 -12 -10 -6 Q -14 -5 -15 -10 Z" fill="#3E2A1E" />
    <circle cx="-4" cy="2" r="1.3" fill={P.inkDark} />
    <circle cx="4" cy="2" r="1.3" fill={P.inkDark} />
    <path d="M -5 10 Q 0 13 5 10" stroke={P.inkDark} strokeWidth="1.2" fill="none" />
  </g>
);
