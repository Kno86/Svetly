import { describe, expect, it } from 'vitest';
import { pathOf } from './territories.controller.js';

const n = (id: string, parentId: string | null) => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  kind: 'locality',
  parentId,
  isActive: true,
  isDefault: false,
});

describe('territory path', () => {
  it('lists ancestors from the top down', () => {
    const all = [n('r', null), n('d', 'r'), n('l', 'd')];
    expect(pathOf(all[2]!, all).map((p) => p.slug)).toEqual(['r', 'd']);
  });

  it('stops on cycles instead of looping forever', () => {
    const all = [n('a', 'b'), n('b', 'a')];
    expect(pathOf(all[0]!, all).map((p) => p.slug)).toEqual(['b']);
  });
});
