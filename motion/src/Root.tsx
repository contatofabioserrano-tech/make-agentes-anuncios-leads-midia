import React from 'react';
import {Composition} from 'remotion';
import {KAIROS_DEFAULTS} from './brand';
import {BrandSweep} from './BrandSweep';
import {CTACard} from './CTACard';
import {KineticText} from './KineticText';
import {LogoIntro} from './LogoIntro';
import {LowerThird} from './LowerThird';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LogoIntro"
        component={LogoIntro}
        durationInFrames={75}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={KAIROS_DEFAULTS}
      />
      <Composition
        id="BrandSweep"
        component={BrandSweep}
        durationInFrames={33}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          ...KAIROS_DEFAULTS,
          word: '24 HORAS',
          direction: 'fromRight' as const,
          color: 'primary' as const,
        }}
      />
      <Composition
        id="KineticText"
        component={KineticText}
        durationInFrames={90}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={KAIROS_DEFAULTS}
      />
      <Composition
        id="CTACard"
        component={CTACard}
        durationInFrames={150}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          ...KAIROS_DEFAULTS,
          line1: 'AGENDE SUA CONSULTA',
        }}
      />
      <Composition
        id="LowerThird"
        component={LowerThird}
        durationInFrames={120}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={KAIROS_DEFAULTS}
      />
    </>
  );
};
