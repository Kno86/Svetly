import { describe, expect, it } from 'vitest';
import { isSearchType, SEARCH_TYPES } from './search';

describe('search types', () => {
  it('maps every type to a public URL', () => {
    expect(SEARCH_TYPES.posts.href('1')).toBe('/feed/1');
    expect(SEARCH_TYPES.lost_found.href('a')).toBe('/lost-found/a');
    expect(SEARCH_TYPES.directory.href('x')).toBe('/directory#x');
  });
  it('rejects unknown types', () => {
    expect(isSearchType('jobs')).toBe(true);
    expect(isSearchType('toString')).toBe(false);
    expect(isSearchType(undefined)).toBe(false);
  });
});
