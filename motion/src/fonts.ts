import {loadFont} from '@remotion/google-fonts/Poppins';

const {fontFamily} = loadFont('normal', {
  weights: ['500', '600', '700', '800', '900'],
  subsets: ['latin', 'latin-ext'],
});

export const POPPINS = fontFamily;
