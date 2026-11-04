import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {BrandProps} from './brand';

// 75 frames — fundo na cor da marca, logo entra com spring + glow pulsante.
export const LogoIntro: React.FC<BrandProps> = ({primary, accent, logoUrl}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const scaleIn = spring({
    frame,
    fps,
    config: {damping: 11, stiffness: 120, mass: 0.8},
    durationInFrames: 40,
  });
  const scale = interpolate(scaleIn, [0, 1], [0.35, 1]);
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Glow suave pulsando (duas oscilacoes ao longo do clipe)
  const pulse = (Math.sin((frame / 75) * Math.PI * 4 - Math.PI / 2) + 1) / 2;
  const glowRadius = interpolate(pulse, [0, 1], [22, 60]);
  const glowAlpha = interpolate(pulse, [0, 1], [0.25, 0.6]);

  // Saida discreta no final (fade rapido para o corte do ffmpeg)
  const exitOpacity = interpolate(frame, [68, 75], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: primary}}>
      {/* Gradiente radial sutil para dar profundidade */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 46%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 45%, rgba(0,0,0,0.22) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: exitOpacity,
        }}
      >
        <Img
          src={logoUrl}
          style={{
            width: 620,
            opacity,
            transform: `scale(${scale})`,
            filter: `drop-shadow(0 0 ${glowRadius}px ${accent}${Math.round(
              glowAlpha * 255,
            )
              .toString(16)
              .padStart(2, '0')})`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
