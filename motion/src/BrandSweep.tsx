import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {BrandProps, SweepColor, SweepDirection} from './brand';
import {POPPINS} from './fonts';

export type BrandSweepProps = BrandProps & {
  direction: SweepDirection;
  color: SweepColor;
};

// 33 frames — painel full-screen varre a tela com borda de ataque arredondada,
// logo + palavra opcional dao "pop" com spring, painel varre pra fora no fim.
export const BrandSweep: React.FC<BrandSweepProps> = ({
  primary,
  accent,
  logoUrl,
  word,
  direction,
  color,
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();

  const panelColor = color === 'accent' ? accent : primary;
  const contrastColor = color === 'accent' ? '#FFFFFF' : accent;
  const sign = direction === 'fromRight' ? 1 : -1;

  const bezier = Easing.bezier(0.16, 1, 0.3, 1); // easeOutExpo-like

  // Entrada: frames 0-11 | Hold: 11-23 | Saida: 23-33 (sai pelo lado oposto)
  const enter = interpolate(frame, [0, 11], [1, 0], {
    easing: bezier,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(frame, [23, 33], [0, 1], {
    easing: Easing.bezier(0.7, 0, 0.84, 0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateX = sign * enter * (width * 1.25) - sign * exit * (width * 1.25);

  // Borda de ataque arredondada: o painel e mais largo que a tela e a ponta
  // que entra primeiro tem raio gigante.
  const leadingRadius = 999;
  const radiusStyle: React.CSSProperties =
    direction === 'fromRight'
      ? {borderTopLeftRadius: leadingRadius, borderBottomLeftRadius: leadingRadius}
      : {borderTopRightRadius: leadingRadius, borderBottomRightRadius: leadingRadius};

  const pop = spring({
    frame: frame - 8,
    fps,
    config: {damping: 10, stiffness: 210, mass: 0.5},
    durationInFrames: 14,
  });
  const contentOpacity = interpolate(frame, [8, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentExit = interpolate(frame, [24, 30], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: 'transparent'}}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: direction === 'fromRight' ? 0 : '-25%',
          width: '125%',
          backgroundColor: panelColor,
          transform: `translateX(${translateX}px)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 48,
          ...radiusStyle,
        }}
      >
        <div
          style={{
            opacity: contentOpacity * contentExit,
            transform: `scale(${interpolate(pop, [0, 1], [0.4, 1])})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 40,
          }}
        >
          <Img src={logoUrl} style={{width: 460}} />
          {word ? (
            <div
              style={{
                fontFamily: POPPINS,
                fontWeight: 900,
                fontSize: 110,
                letterSpacing: 6,
                color: contrastColor,
                textAlign: 'center',
                lineHeight: 1.05,
              }}
            >
              {word}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
