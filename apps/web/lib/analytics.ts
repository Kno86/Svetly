/** Browser-side events; the API validates and strips them again (see docs/ANALYTICS.md). */
export interface ClientEvent {
  name: 'page_view' | 'contact_click' | 'client_error';
  path: string;
  referrer?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
  kind?: 'phone' | 'website' | 'email' | 'map';
  code?: string;
}

/** Respect Do Not Track and Global Privacy Control: nothing is sent. */
export function trackingAllowed(nav: {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}) {
  return nav.doNotTrack !== '1' && nav.globalPrivacyControl !== true;
}

export function utmFrom(search: string): ClientEvent['utm'] | undefined {
  const p = new URLSearchParams(search);
  const pick = (k: string) => {
    const v = p.get(`utm_${k}`)?.trim().toLowerCase();
    return v && /^[a-z0-9._-]{1,60}$/.test(v) ? v : undefined;
  };
  const utm = { source: pick('source'), medium: pick('medium'), campaign: pick('campaign') };
  return utm.source || utm.medium || utm.campaign ? utm : undefined;
}

/** Classifies an outbound contact link; returns null for ordinary navigation. */
export function contactKind(href: string, ownHost: string): ClientEvent['kind'] | null {
  if (href.startsWith('tel:')) return 'phone';
  if (href.startsWith('mailto:')) return 'email';
  try {
    const url = new URL(href);
    if (url.hostname === ownHost) return null;
    if (
      /(^|\.)(yandex\.[a-z]+|google\.[a-z]+|2gis\.[a-z]+)$/.test(url.hostname) &&
      /map/.test(href)
    )
      return 'map';
    return url.protocol.startsWith('http') ? 'website' : null;
  } catch {
    return null;
  }
}

export function send(event: ClientEvent) {
  void fetch('/api/analytics/events', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => undefined);
}
