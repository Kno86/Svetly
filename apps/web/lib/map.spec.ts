import { describe, expect, it } from 'vitest';
import { mapLink } from './map';

describe('mapLink', () => {
  it('uses verified coordinates as a point', () => {
    expect(mapLink({ location: 'ул. Новая, 1', latitude: 54.9, longitude: 83.1 })).toBe(
      'https://yandex.ru/maps/?pt=83.1,54.9&z=17&l=map',
    );
  });
  it('falls back to a text search and never invents a point', () => {
    expect(mapLink({ location: 'ул. Новая, 1', latitude: null, longitude: null })).toBe(
      'https://yandex.ru/maps/?text=%D1%83%D0%BB.%20%D0%9D%D0%BE%D0%B2%D0%B0%D1%8F%2C%201',
    );
    expect(mapLink({ location: null, latitude: null, longitude: null })).toBeNull();
  });
});
