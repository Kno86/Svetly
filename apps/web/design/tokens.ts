/**
 * SVETLY design tokens: the single source of truth for colour, type, spacing and shape.
 * `app/styles/tokens.css` mirrors these values as CSS custom properties (checked by tokens.spec.ts).
 * Palette: redesign direction A «Рассвет» (docs/redesign/DESIGN_SYSTEM.md). Sun and sage are decor-only;
 * text and interactive tones meet WCAG 2.2 AA.
 */
export const palette = {
  ink: '#24201C',
  primary: '#B4441E',
  primaryHover: '#8E3315',
  primarySoft: '#F8E6DD',
  sage: '#8FA88A',
  sageText: '#4E6E4B',
  sun: '#F2B441',
  sunSoft: '#FDF0D5',
  sunText: '#8A5600',
  sky: '#2F5D7C',
  skySoft: '#E3EEF5',
  paper: '#FAF6EF',
  sand: '#F1EADF',
  white: '#FFFFFF',
  textPrimary: '#24201C',
  textSecondary: '#6B6158',
  border: '#E7DFD2',
  borderStrong: '#8C8174',
} as const;

export const semantic = {
  success: '#276B43',
  successSurface: '#E3F2E8',
  warning: '#8A5600',
  warningSurface: '#FFF3D6',
  error: '#B42318',
  errorSurface: '#FDE8E6',
  info: '#2F5D7C',
  infoSurface: '#E3EEF5',
  focus: '#2F5D7C',
  focusOnDark: '#F2B441',
  overlay: 'rgba(36, 32, 28, 0.56)',
  surface: '#FFFFFF',
  surfaceMuted: '#F1EADF',
  surfaceInverse: '#24201C',
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

/** Fluid type scale (Golos Text + Literata, OFL). */
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
  [palette.textPrimary, palette.paper, 7, 'body text on paper'],
  [palette.textPrimary, palette.white, 7, 'body text on white'],
  [palette.textSecondary, palette.paper, 4.5, 'secondary text on paper'],
  [palette.textSecondary, palette.sand, 4.5, 'secondary text on sand'],
  [palette.textSecondary, palette.white, 4.5, 'secondary text on white'],
  [palette.sky, palette.white, 4.5, 'link on white'],
  [palette.sky, palette.paper, 4.5, 'link on paper'],
  [palette.primary, palette.paper, 4.5, 'primary text on paper'],
  [palette.primaryHover, palette.primarySoft, 4.5, 'active nav item'],
  [palette.ink, palette.paper, 7, 'headings on paper'],
  [palette.white, palette.primary, 4.5, 'primary button label'],
  [palette.white, palette.primaryHover, 4.5, 'primary button hover'],
  [palette.paper, palette.ink, 7, 'text on inverse surface'],
  [palette.sun, palette.ink, 4.5, 'sun accent on inverse surface'],
  [palette.ink, palette.sun, 4.5, 'accent button label'],
  [palette.sageText, palette.paper, 4.5, 'green text/link on paper'],
  [palette.sunText, palette.sunSoft, 4.5, 'sun badge text'],
  [palette.borderStrong, palette.white, 3, 'form control boundary'],
  [palette.borderStrong, palette.paper, 3, 'form control boundary on paper'],
  [semantic.focus, palette.paper, 3, 'focus ring on paper'],
  [semantic.focus, palette.white, 3, 'focus ring on white'],
  [semantic.focusOnDark, palette.ink, 3, 'focus ring on inverse surface'],
  [semantic.success, semantic.successSurface, 4.5, 'success message'],
  [semantic.warning, semantic.warningSurface, 4.5, 'warning message'],
  [semantic.error, semantic.errorSurface, 4.5, 'error message'],
  [semantic.error, palette.white, 4.5, 'field error text'],
  [semantic.info, semantic.infoSurface, 4.5, 'info message'],
];
