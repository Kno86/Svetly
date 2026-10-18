import { describe, expect, it } from 'vitest';
import { getVersionInfo } from './version.js';

describe('getVersionInfo', () => {
  it('reports package version and build metadata', () => {
    expect(getVersionInfo({ GIT_SHA: 'abc123', BUILD_TIME: '2026-10-18T00:00:00Z' })).toEqual({
      service: 'svetly-api',
      version: '0.1.0',
      commit: 'abc123',
      builtAt: '2026-10-18T00:00:00Z',
    });
  });

  it('falls back to unknown metadata', () => {
    const info = getVersionInfo({});
    expect(info.commit).toBe('unknown');
    expect(info.builtAt).toBe('unknown');
  });
});
