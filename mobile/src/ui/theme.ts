import { useColorScheme } from 'react-native';

// Väri tarkoittaa aina "tämä tarvitsee sinua". Kunnossa oleva koti on lähes väritön.
const light = {
  paper: '#F2F4F3',
  surface: '#FBFCFB',
  ink: '#1F2A2E',
  inkSoft: '#4F5D63',
  muted: '#6E7B80',
  line: '#D5DCDB',
  lineStrong: '#9EABAD',
  wall: '#1F2A2E',
  signal: '#BF3528',
  signalTint: '#F8E2DE',
  onSignal: '#FFFFFF',
  glow: '#D9A62E',
  glowTint: '#FAEECB',
  glowInk: '#6E4F00',
  ok: '#2B6B55',
  scrim: 'rgba(20, 28, 30, 0.45)',
};

const dark: typeof light = {
  paper: '#121718',
  surface: '#1A2123',
  ink: '#E4EBEA',
  inkSoft: '#AAB6B8',
  muted: '#7F8D91',
  line: '#2A3437',
  lineStrong: '#52616A',
  wall: '#C9D3D2',
  signal: '#FF7B6B',
  signalTint: '#3A1F1B',
  onSignal: '#1A0907',
  glow: '#E8BC52',
  glowTint: '#352B12',
  glowInk: '#F2D07A',
  ok: '#76C7A8',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
};

// Muotosääntö: kaikki painettava on pillerin muotoinen, alalaatikot 24, ilmoituslaatikot 16, pohjapiirros suorakulmainen.
export const radius = { pill: 999, sheet: 24, box: 16 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, gutter: 20 };
