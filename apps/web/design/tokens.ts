/**
 * SVETLY design tokens: the single source of truth for colour, type, spacing and shape.
 * `app/styles/tokens.css` mirrors these values as CSS custom properties (checked by tokens.spec.ts).
 * Brand palette values come from the product specification; text/interactive tones were added
 * where the original colour does not meet WCAG 2.2 AA contrast.
 */
export const palette = {
  deepForest: '#103C2F',
  forest: '#245844',
  forestHover: '#1B4A39',
  leafGreen: '#7D9D58',
  leafText: '#4F6B33',
  warmGold: '#E9BC66',
  goldSoft: '#F6E7C8',
  goldText: '#7A4F0E',
  ivory: '#F7F6F0',
  sand: '#EFEDE4',
  white: '#FFFFFF',
  textPrimary: '#202721',
  textSecondary: '#5C645E',
  border: '#E3E7E1',
  borderStrong: '#7E8780',
} as const;

export const semantic = {
  success: '#2E6B3F',
  successSurface: '#E5F0E7',
  warning: '#8A5A12',
  warningSurface: '#FBF0DA',
  error: '#B3261E',
  errorSurface: '#FBE7E5',
  info: '#1F5F8B',
  infoSurface: '#E3EEF6',
  focus: '#245844',
  focusOnDark: '#E9BC66',
  overlay: 'rgba(16, 60, 47, 0.56)',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEDE4',
  surfaceInverse: '#103C2F',
} as const;

/** 4 px base grid. */
export const space = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
} as const;

export const radius = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  pill: '999px',
} as const;

/** Fluid type scale (Manrope Variable, OFL). */
export const fontSize = {
  xs: '0.8125rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: 'clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)',
  '2xl': 'clamp(1.5rem, 1.25rem + 1vw, 2rem)',
  '3xl': 'clamp(2rem, 1.5rem + 2vw, 3rem)',
  '4xl': 'clamp(2.5rem, 1.75rem + 3.2vw, 4rem)',
} as const;

/** Mobile-first breakpoints (min-width). */
export const breakpoints = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const;

export const layout = {
  containerMax: '76rem',
  gutter: 'clamp(1rem, 0.5rem + 2vw, 2rem)',
  columns: 12,
} as const;

/** Minimum contrast checks enforced by tests: [foreground, background, minimum ratio, usage]. */
export const contrastPairs: ReadonlyArray<readonly [string, string, number, string]> = [
  [palette.textPrimary, palette.ivory, 7, 'body text on ivory'],
  [palette.textPrimary, palette.white, 7, 'body text on white'],
  [palette.textSecondary, palette.ivory, 4.5, 'secondary text on ivory'],
  [palette.textSecondary, palette.sand, 4.5, 'secondary text on sand'],
  [palette.textSecondary, palette.white, 4.5, 'secondary text on white'],
  [palette.deepForest, palette.ivory, 7, 'headings on ivory'],
  [palette.white, palette.forest, 4.5, 'primary button label'],
  [palette.white, palette.forestHover, 4.5, 'primary button hover'],
  [palette.ivory, palette.deepForest, 7, 'text on inverse surface'],
  [palette.warmGold, palette.deepForest, 4.5, 'gold accent on inverse surface'],
  [palette.deepForest, palette.warmGold, 4.5, 'accent button label'],
  [palette.leafText, palette.ivory, 4.5, 'green text/link on ivory'],
  [palette.goldText, palette.goldSoft, 4.5, 'gold badge text'],
  [palette.borderStrong, palette.white, 3, 'form control boundary'],
  [palette.borderStrong, palette.ivory, 3, 'form control boundary on ivory'],
  [semantic.focus, palette.ivory, 3, 'focus ring on ivory'],
  [semantic.focus, palette.white, 3, 'focus ring on white'],
  [semantic.focusOnDark, palette.deepForest, 3, 'focus ring on inverse surface'],
  [semantic.success, semantic.successSurface, 4.5, 'success message'],
  [semantic.warning, semantic.warningSurface, 4.5, 'warning message'],
  [semantic.error, semantic.errorSurface, 4.5, 'error message'],
  [semantic.error, palette.white, 4.5, 'field error text'],
  [semantic.info, semantic.infoSurface, 4.5, 'info message'],
];
