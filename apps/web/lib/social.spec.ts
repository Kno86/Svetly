import { describe, expect, it } from 'vitest';
import {
  excerpt,
  hostOf,
  mergePages,
  threadComments,
  type CommentView,
  type FeedPost,
} from './social';

const c = (id: string, parentId: string | null = null): CommentView => ({
  id,
  parentId,
  body: id,
  createdAt: '2026-01-01T00:00:00Z',
  editedAt: null,
  author: { name: 'A' },
  mine: false,
});

describe('social helpers', () => {
  it('threads replies under their top-level comment', () => {
    const t = threadComments([c('a'), c('b'), c('r1', 'a'), c('orphan', 'missing')]);
    expect(t.map((x) => x.id)).toEqual(['a', 'b']);
    expect(t[0]!.replies.map((x) => x.id)).toEqual(['r1']);
  });

  it('merges feed pages without duplicates', () => {
    const p = (id: string) => ({ id }) as FeedPost;
    expect(mergePages([p('1'), p('2')], [p('2'), p('3')]).map((x) => x.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('shortens long text and extracts link hosts', () => {
    expect(excerpt('a'.repeat(200), 10)).toHaveLength(10);
    expect(excerpt('  short  text ')).toBe('short text');
    expect(hostOf('https://example.org/path')).toBe('example.org');
    expect(hostOf('not a url')).toBe('not a url');
  });
});
