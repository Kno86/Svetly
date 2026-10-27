import { describe, expect, it } from 'vitest';
import {
  conversationPreview,
  dropDelivered,
  mergeMessages,
  newClientId,
  type ChatMessage,
  type ConversationSummary,
} from './messages';

const m = (id: string, createdAt: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  mine: false,
  body: id,
  mediaIds: [],
  deleted: false,
  createdAt,
  ...extra,
});

describe('messages helpers', () => {
  it('builds an API-compatible idempotency key', () => {
    const id = newClientId(() => '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newClientId()).not.toBe(newClientId());
  });

  it('merges polled messages without duplicates, in order', () => {
    const a = m('a', '2026-01-01T10:00:00Z');
    const b = m('b', '2026-01-01T10:01:00Z');
    const bDeleted = { ...b, deleted: true, body: '' };
    const c = m('c', '2026-01-01T10:01:00Z');
    expect(mergeMessages([a, b], [bDeleted, c]).map((x) => [x.id, x.deleted])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ]);
  });

  it('drops pending sends already confirmed by the server', () => {
    const out = [
      { clientId: 'k1', body: 'x', mediaIds: [], state: 'failed' as const },
      { clientId: 'k2', body: 'y', mediaIds: [], state: 'sending' as const },
    ];
    const delivered = [m('1', '2026-01-01T10:00:00Z', { mine: true, clientId: 'k1' })];
    expect(dropDelivered(out, delivered).map((o) => o.clientId)).toEqual(['k2']);
  });

  it('describes the last message honestly', () => {
    const base: ConversationSummary = {
      id: '1',
      other: null,
      lastMessageAt: null,
      last: { mine: true, deleted: false, preview: '', images: 2 },
      unread: 0,
    };
    expect(conversationPreview(base)).toBe('Вы: фото (2)');
    expect(conversationPreview({ ...base, last: { ...base.last!, deleted: true } })).toBe(
      'Вы: сообщение удалено',
    );
    expect(conversationPreview({ ...base, last: null })).toBe('');
  });
});
