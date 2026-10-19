import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('transliterates Cyrillic and normalises separators', () => {
    expect(slugify('Продам велосипед «Кама» — недорого!')).toBe('prodam-velosiped-kama-nedorogo');
  });
  it('falls back for titles without usable characters', () => {
    expect(slugify('!!!')).toBe('item');
  });
  it('limits length without trailing dashes', () => {
    expect(slugify('а'.repeat(100)).length).toBeLessThanOrEqual(60);
  });
  it('adds a suffix', () => {
    expect(uniqueSlug('Ёлка', () => 'abc12')).toBe('elka-abc12');
  });
});
