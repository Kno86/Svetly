import { createHash } from 'node:crypto';

/** Events a browser may report. Everything else is recorded by the server itself. */
export const CLIENT_EVENTS = ['page_view', 'contact_click', 'client_error'] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

/** Documented event schema (docs/ANALYTICS.md). */
export const EVENT_NAMES = [
  ...CLIENT_EVENTS,
  'search',
  'registration',
  'publication_submitted',
  'publication_moderated',
  'comment_created',
  'conversation_started',
  'favorite_added',
  'event_registration',
  'business_application',
  'business_inquiry',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Server actions already written to the audit log that are also counted as analytics events. */
export function eventFromAudit(
  action: string,
  entityType?: string,
): { name: EventName; entityType?: string; meta?: Record<string, string> } | null {
  if (action === 'auth.sign_up') return { name: 'registration' };
  if (
    [
      'announcement.created',
      'job.created',
      'lost_found.created',
      'post.created',
      'issue.created',
      'group.created',
    ].includes(action)
  )
    return { name: 'publication_submitted', entityType: action.split('.')[0] };
  const moderated = /^moderation\.([a-z_]+)_(approved|rejected|unpublished)$/.exec(action);
  if (moderated)
    return {
      name: 'publication_moderated',
      entityType: moderated[1],
      meta: { decision: moderated[2]! },
    };
  if (action === 'comment.created') return { name: 'comment_created', entityType };
  if (action === 'conversation.created') return { name: 'conversation_started' };
  if (action === 'business.application_submitted') return { name: 'business_application' };
  if (action === 'business.inquiry_sent') return { name: 'business_inquiry' };
  return null;
}

/** Pseudonymous, not anonymous: lets us count distinct active users without storing the user id. */
export function actorHash(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return createHash('sha256').update(`svetly-analytics:${userId}`).digest('hex').slice(0, 16);
}

/**
 * Search queries are kept only when they cannot plausibly contain contact data:
 * no e-mail, no URL, no run of 5+ digits (phones, document numbers).
 */
export function sanitizeQuery(q: string): string | null {
  const v = q.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
  if (!v || /@|https?:|www\.|\d[\d\s()+-]{4,}\d/.test(v)) return null;
  return v;
}

/** Top-level section of a site path, e.g. `/jobs/povar` → `jobs`; `/` → `home`. */
export function moduleOf(path: string): string {
  const seg = path.split(/[?#]/)[0]!.split('/').filter(Boolean)[0];
  return seg ? seg.slice(0, 40) : 'home';
}

/** Strips query strings and fragments so tokens or personal parameters never reach storage. */
export function cleanPath(path: string): string | null {
  const p = path.split(/[?#]/)[0]!;
  if (!p.startsWith('/') || p.length > 200) return null;
  return p;
}

export function referrerHost(referrer: string | undefined, ownHost?: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host && host !== ownHost ? host.slice(0, 100) : null;
  } catch {
    return null;
  }
}
