import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {BrandProps} from './brand';
import {POPPINS} from './fonts';

// 120 frames — barra de endereco entra da esquerda com notch na cor accent.
// FUNDO TRANSPARENTE: renderizar com --codec=prores --prores-profile=4444.
export const LowerThird: React.FC<BrandProps> = ({
  primary,
  accent,
  address,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: {damping: 15, stiffness: 120, mass: 0.9},
    durationInFrames: 30,
  });
  const exit = interpolate(frame, [102, 118], [0, 1], {
    easing: Easing.bezier(0.7, 0, 0.84, 0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const x = interpolate(enter, [0, 1], [-1200, 0]) - exit * 1300;

  const notchS = spring({
    frame: frame - 10,
    fps,
    config: {damping: 11, stiffness: 220, mass: 0.5},
    durationInFrames: 18,
  });

  return (
    <AbsoluteFill style={{backgroundColor: 'transparent'}}>
      <div
        style={{
          position: 'absolute',
          left: 60,
          bottom: 320,
          transform: `translateX(${x}px)`,
          display: 'flex',
          alignItems: 'stretch',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        {/* Notch accent */}
        <div
          style={{
            width: 22,
            backgroundColor: accent,
            transform: `scaleY(${notchS})`,
            transformOrigin: 'center',
          }}
        />
        <div
          style={{
            backgroundColor: primary,
            padding: '30px 54px 30px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: POPPINS,
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: 4,
              color: accent,
            }}
          >
            ONDE ESTAMOS
          </span>
          <span
            style={{
              fontFamily: POPPINS,
              fontWeight: 600,
              fontSize: 40,
              color: '#FFFFFF',
            }}
          >
            {address}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
