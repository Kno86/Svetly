/**
 * Guards for any future AI provider (ТЗ §17). They run before data leaves SVETLY and are tested now so
 * the integration cannot be wired without them.
 */
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;
const PHONE = /(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b|\b\d[\d\s()+-]{8,}\d\b/g;

/** Replaces e-mails and phone-like numbers before text is sent to an external model. */
export function redactPersonalData(text: string): string {
  return text.replace(EMAIL, '[email]').replace(PHONE, '[телефон]');
}

/**
 * Wraps retrieved content as quoted data so instructions inside it are not treated as commands.
 * The delimiter is stripped from the content itself to prevent breaking out of the block.
 */
export function quoteUntrusted(source: { title: string; url: string; text: string }): string {
  const clean = (s: string) => redactPersonalData(s.replaceAll('<<<', '').replaceAll('>>>', ''));
  return `<<<source url="${clean(source.url)}" title="${clean(source.title)}">>>\n${clean(source.text).slice(0, 4000)}\n<<<end>>>`;
}
