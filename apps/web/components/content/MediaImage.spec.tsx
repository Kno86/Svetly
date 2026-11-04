// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MediaImage } from './MediaImage';

describe('MediaImage', () => {
  it('serves uploads through the optimizer with responsive sizes', () => {
    const { container } = render(<MediaImage id="abc" alt="Фото 1" variant="gallery" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Фото 1');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('sizes')).toContain('50vw');
    expect(img.getAttribute('srcset')).toContain('/_next/image?url=%2Fapi%2Fmedia%2Fabc');
  });

  it('loads a cover eagerly with high priority', () => {
    const { container } = render(<MediaImage id="abc" alt="" variant="cover" eager />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });
});
