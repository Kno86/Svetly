import { describe, expect, it } from 'vitest';
import { contactKind, trackingAllowed, utmFrom } from './analytics';

describe('client analytics helpers', () => {
  it('honours Do Not Track and GPC', () => {
    expect(trackingAllowed({})).toBe(true);
    expect(trackingAllowed({ doNotTrack: '1' })).toBe(false);
    expect(trackingAllowed({ globalPrivacyControl: true })).toBe(false);
  });
  it('keeps only safe UTM values', () => {
    expect(utmFrom('?utm_source=VK&utm_medium=social&x=1')).toEqual({
      source: 'vk',
      medium: 'social',
      campaign: undefined,
    });
    expect(utmFrom('?utm_source=<script>')).toBeUndefined();
    expect(utmFrom('')).toBeUndefined();
  });
  it('classifies contact links', () => {
    expect(contactKind('tel:+79130000000', 's.ru')).toBe('phone');
    expect(contactKind('mailto:a@b.ru', 's.ru')).toBe('email');
    expect(contactKind('https://shop.example/', 's.ru')).toBe('website');
    expect(contactKind('https://s.ru/news', 's.ru')).toBeNull();
    expect(contactKind('https://yandex.ru/maps/?pt=1', 's.ru')).toBe('map');
  });
});
