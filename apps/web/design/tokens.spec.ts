import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { contrastPairs, palette, semantic, space, radius } from './tokens';

const css = readFileSync(join(import.meta.dirname, '../app/styles/tokens.css'), 'utf8');
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cssVar = (name: string) =>
  new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim().toLowerCase();

describe('contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });

  it.each(contrastPairs)('%s on %s meets %d:1 (%s)', (fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('documents that raw Warm Gold and Leaf Green are not text colours on light surfaces', () => {
    expect(contrastRatio(palette.warmGold, palette.ivory)).toBeLessThan(3);
    expect(contrastRatio(palette.leafGreen, palette.ivory)).toBeLessThan(4.5);
  });
});

describe('tokens.css mirrors tokens.ts', () => {
  it.each(Object.entries(palette))('palette %s', (name, value) => {
    expect(cssVar(`color-${kebab(name)}`)).toBe(value.toLowerCase());
  });
  it.each(Object.entries(semantic))('semantic %s', (name, value) => {
    expect(cssVar(`color-${kebab(name)}`)).toBe(value.toLowerCase());
  });
  it.each(Object.entries(space))('space %s', (name, value) => {
    expect(cssVar(`space-${name}`)).toBe(value);
  });
  it.each(Object.entries(radius))('radius %s', (name, value) => {
    expect(cssVar(`radius-${name}`)).toBe(value);
  });
});
