import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {BrandProps} from './brand';
import {POPPINS} from './fonts';

// 90 frames — 1-2 linhas Poppins bold, entrada por palavra com spring
// escalonado, keyword destacada na cor accent. FUNDO TRANSPARENTE:
// renderizar com --codec=prores --prores-profile=4444.
export const KineticText: React.FC<BrandProps> = ({
  primary,
  accent,
  line1,
  line2,
  word,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const lines = [line1, line2].filter((l) => l && l.trim().length > 0);
  const keyword = (word ?? '').trim().toLowerCase();

  let wordIndex = -1;

  const exitOpacity = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <div style={{opacity: exitOpacity, padding: '0 80px'}}>
        {lines.map((line, li) => (
          <div
            key={li}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0 26px',
              marginBottom: li === 0 && lines.length > 1 ? 18 : 0,
            }}
          >
            {line.split(/\s+/).map((w, wi) => {
              wordIndex += 1;
              const delay = 4 + wordIndex * 5; // stagger por palavra
              const s = spring({
                frame: frame - delay,
                fps,
                config: {damping: 12, stiffness: 190, mass: 0.6},
                durationInFrames: 22,
              });
              const isKeyword =
                keyword.length > 0 &&
                w.toLowerCase().replace(/[.,!?]/g, '') === keyword;
              return (
                <span
                  key={wi}
                  style={{
                    display: 'inline-block',
                    fontFamily: POPPINS,
                    fontWeight: 800,
                    fontSize: 108,
                    lineHeight: 1.15,
                    letterSpacing: 1,
                    color: isKeyword ? accent : '#FFFFFF',
                    textShadow: `0 4px 24px rgba(0,0,0,0.35)`,
                    opacity: s,
                    transform: `translateY(${interpolate(
                      s,
                      [0, 1],
                      [90, 0],
                    )}px) scale(${interpolate(s, [0, 1], [0.8, 1])})`,
                  }}
                >
                  {isKeyword ? (
                    <span
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: -14,
                          right: -14,
                          top: 12,
                          bottom: 4,
                          backgroundColor: primary,
                          borderRadius: 18,
                          zIndex: -1,
                        }}
                      />
                      {w}
                    </span>
                  ) : (
                    w
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
