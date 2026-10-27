/** Client helpers for direct messages and notifications. Delivery is periodic polling, not realtime. */
export const POLL_INTERVAL_MS = 15_000;
export const MAX_MESSAGE_IMAGES = 3;
export const MAX_MESSAGE_LENGTH = 2000;

export interface ChatMessage {
  id: string;
  mine: boolean;
  body: string;
  mediaIds: string[];
  deleted: boolean;
  createdAt: string;
  clientId?: string | null;
}

export interface OutgoingMessage {
  clientId: string;
  body: string;
  mediaIds: string[];
  state: 'sending' | 'failed';
  error?: string;
}

export interface ConversationSummary {
  id: string;
  other: { id: string; name: string } | null;
  lastMessageAt: string | null;
  last: { mine: boolean; deleted: boolean; preview: string; images: number } | null;
  unread: number;
}

export interface ConversationInfo {
  id: string;
  other: { id: string; name: string } | null;
  blockedByMe: boolean;
  canSend: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  category?: string;
  title: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Idempotency key for a send: a retry with the same key never creates a second message. */
export function newClientId(random: () => string = () => crypto.randomUUID()): string {
  return random().replace(/[^A-Za-z0-9_-]/g, '');
}

/** Merges fetched messages into the list: de-duplicated by id, in chronological order. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
  );
}

/** Drops pending sends that the server already confirmed (e.g. seen via polling). */
export function dropDelivered(
  outgoing: OutgoingMessage[],
  delivered: ChatMessage[],
): OutgoingMessage[] {
  const keys = new Set(delivered.filter((m) => m.mine && m.clientId).map((m) => m.clientId));
  return outgoing.filter((o) => !keys.has(o.clientId));
}

export function conversationPreview(c: ConversationSummary): string {
  if (!c.last) return '';
  const prefix = c.last.mine ? 'Вы: ' : '';
  if (c.last.deleted) return `${prefix}сообщение удалено`;
  if (c.last.preview) return prefix + c.last.preview;
  return `${prefix}фото (${c.last.images})`;
}
