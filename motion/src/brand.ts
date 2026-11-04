import {staticFile} from 'remotion';

export type BrandProps = {
  primary: string;
  accent: string;
  logoUrl: string;
  line1: string;
  line2: string;
  word: string;
  phone: string;
  whatsapp: string;
  address: string;
  tagline: string;
};

export type SweepDirection = 'fromRight' | 'fromLeft';
export type SweepColor = 'primary' | 'accent';

/** Marca padrão do portal: Grupo Kairós (único cliente). Telefone/endereço vêm do cadastro em Marcas. */
export const KAIROS_DEFAULTS: BrandProps = {
  primary: '#111111',
  accent: '#E11C24',
  logoUrl: staticFile('logo.png'),
  line1: 'IMPORTAÇÃO SEM SUSTO.',
  line2: 'BRASIL E CHINA.',
  word: 'KAIRÓS',
  phone: '',
  whatsapp: '',
  address: '',
  tagline: 'Grupo Kairós · Brasil–China',
};
