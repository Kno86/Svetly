import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = import.meta.dirname;
const svgs = readdirSync(dir).filter((f) => f.endsWith('.svg'));

describe('brand SVG assets', () => {
  it('contains the full logo set', () => {
    for (const name of [
      'svetly-logo.svg',
      'svetly-logo-on-dark.svg',
      'svetly-logo-vertical.svg',
      'svetly-logo-mono.svg',
      'svetly-logo-inverse.svg',
      'svetly-mark.svg',
      'svetly-mark-mono.svg',
      'svetly-mark-inverse.svg',
      'svetly-mark-small.svg',
    ]) {
      expect(svgs).toContain(name);
    }
  });

  it.each(svgs)('%s is pure vector (no raster, no live text, no external refs)', (name) => {
    const svg = readFileSync(join(dir, name), 'utf8');
    expect(svg).toMatch(/^<svg [^>]*viewBox="/);
    expect(svg).not.toMatch(/<image|<text|<foreignObject|data:image|https?:\/\/(?!www\.w3\.org)/);
    expect(svg).toContain('<title');
  });

  it.each(svgs.filter((f) => f.includes('mono') || f.includes('inverse')))(
    '%s uses a single colour',
    (name) => {
      const svg = readFileSync(join(dir, name), 'utf8');
      const colours = new Set(
        (svg.match(/fill="(#[0-9A-Fa-f]{6})"/g) ?? []).map((m) => m.toLowerCase()),
      );
      colours.delete('fill="#fff"');
      colours.delete('fill="#000"');
      expect(colours.size).toBe(1);
    },
  );
});
