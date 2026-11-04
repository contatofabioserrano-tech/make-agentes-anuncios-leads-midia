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
import {POPPINS} from './fonts';

const Row: React.FC<{
  icon: string;
  text: string;
  delay: number;
  accent: string;
}> = ({icon, text, delay, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: {damping: 13, stiffness: 160, mass: 0.7},
    durationInFrames: 26,
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px)`,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 999,
        padding: '22px 44px',
      }}
    >
      <span style={{fontSize: 44}}>{icon}</span>
      <span
        style={{
          fontFamily: POPPINS,
          fontWeight: 600,
          fontSize: 40,
          color: '#FFFFFF',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// 150 frames — bg da marca, logo, titulo type-on, linhas de contato
// subindo escalonadas, faixa de tagline no rodape, float continuo suave.
export const CTACard: React.FC<BrandProps> = ({
  primary,
  accent,
  logoUrl,
  line1,
  phone,
  whatsapp,
  address,
  tagline,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const title = line1 || 'AGENDE SUA CONSULTA';
  const typedChars = Math.round(
    interpolate(frame, [18, 18 + title.length * 1.4], [0, title.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const typed = title.slice(0, typedChars);
  const caretVisible = frame < 70 && Math.floor(frame / 8) % 2 === 0;

  const logoS = spring({
    frame,
    fps,
    config: {damping: 12, stiffness: 130, mass: 0.8},
    durationInFrames: 32,
  });

  // Float continuo suave do bloco central
  const float = Math.sin((frame / fps) * Math.PI * 0.9) * 10;

  const taglineS = spring({
    frame: frame - 78,
    fps,
    config: {damping: 14, stiffness: 140, mass: 0.8},
    durationInFrames: 28,
  });

  return (
    <AbsoluteFill style={{backgroundColor: primary}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 95% 60% at 50% 35%, rgba(255,255,255,0.09) 0%, rgba(0,0,0,0.18) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          transform: `translateY(${float}px)`,
          gap: 44,
          paddingBottom: 140,
        }}
      >
        <Img
          src={logoUrl}
          style={{
            width: 400,
            opacity: logoS,
            transform: `scale(${interpolate(logoS, [0, 1], [0.5, 1])})`,
          }}
        />
        <div
          style={{
            fontFamily: POPPINS,
            fontWeight: 900,
            fontSize: 84,
            letterSpacing: 3,
            color: '#FFFFFF',
            textAlign: 'center',
            minHeight: 100,
          }}
        >
          {typed}
          <span style={{color: accent, opacity: caretVisible ? 1 : 0}}>|</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
            alignItems: 'center',
          }}
        >
          <Row icon={'📞'} text={phone} delay={42} accent={accent} />
          <Row
            icon={'💬'}
            text={whatsapp}
            delay={52}
            accent={accent}
          />
          <Row
            icon={'📍'}
            text={address}
            delay={62}
            accent={accent}
          />
        </div>
      </AbsoluteFill>
      {/* Faixa de tagline no rodape */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 120,
          backgroundColor: accent,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `translateY(${interpolate(taglineS, [0, 1], [130, 0])}px)`,
        }}
      >
        <span
          style={{
            fontFamily: POPPINS,
            fontWeight: 700,
            fontSize: 42,
            color: '#FFFFFF',
            letterSpacing: 1,
          }}
        >
          {tagline}
        </span>
      </div>
    </AbsoluteFill>
  );
};
