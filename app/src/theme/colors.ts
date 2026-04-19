export const colors = {
  teal600: '#4a8e82',
  teal100: '#d4eae7',
  teal900: '#2d5f58',

  amber600: '#c49a3c',
  amber100: '#f2e8d4',
  amber900: '#8a6020',

  rust600: '#b85c38',
  rust100: '#f0ddd5',
  rust900: '#7a3520',

  brown600: '#8b6047',
  brown100: '#e8ddd2',
  brown900: '#5c3d26',

  olive600: '#7a8c52',
  olive100: '#e2e8d4',
  olive900: '#4e5c2e',

  bgWarm: '#f5f0e8',
  bgWarmAlt: '#ede8dc',
  bgBlock: '#e4ddd0',
  bgRoad: '#f0ebe0',
  borderWarm: '#d4c9b5',
  textPrimary: '#3d2e1e',
  textMuted: '#8a7a68',
  textDim: '#9a8a78',

  bgDark: '#1a1208',
  bgDarkDeep: '#0f0a04',

  particleGold: '#c49a3c',
  particleBrown: '#8b6047',
  particleTeal: '#4a8e82',
  particleRust: '#b85c38',
  particleOlive: '#7a8c52',
  particleAmberHi: '#d4a853',
  particleTealDeep: '#5c8a7a',
  particleOrange: '#c47840',
  particleSiena: '#a0522d',
  particleSage: '#6b8e6b',
  particlePeru: '#cd853f',
  particleJade: '#4a7a6a',
} as const;

export type ColorToken = keyof typeof colors;
