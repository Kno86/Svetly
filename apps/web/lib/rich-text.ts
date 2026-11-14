/**
 * Minimal, safe formatting for staff-written texts: `## heading`, `**bold**`, `*italic*`,
 * `[text](https://…)`, `- list`, `1. list`, `> quote`. Parsed into a tree and rendered as React
 * elements, so no HTML from the text ever reaches the page. Plain text renders as paragraphs.
 */
export type Inline =
  { t: 'text'; v: string } | { t: 'b' | 'i'; c: Inline[] } | { t: 'a'; href: string; c: Inline[] };

export type Block =
  | { t: 'p' | 'quote'; lines: Inline[][] }
  | { t: 'h'; level: 2 | 3; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] };

const INLINE = /\*\*(.+?)\*\*|\*(?![\s*])(.+?)\*|\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

export function safeHref(url: string): string | undefined {
  return /^https?:\/\/[^\s]+$/i.test(url) || /^\/(?!\/)/.test(url) ? url : undefined;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push({ t: 'text', v: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ t: 'b', c: parseInline(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'i', c: parseInline(m[2]) });
    else {
      const href = safeHref(m[4]!);
      out.push(href ? { t: 'a', href, c: parseInline(m[3]!) } : { t: 'text', v: m[0] });
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

const HEADING = /^(#{1,3})\s+(.+)$/;
const BULLET = /^[-*•]\s+/;
const NUMBER = /^\d+[.)]\s+/;

type Kind = 'h' | 'ul' | 'ol' | 'quote' | 'p';

const kindOf = (line: string): Kind =>
  HEADING.test(line)
    ? 'h'
    : BULLET.test(line)
      ? 'ul'
      : NUMBER.test(line)
        ? 'ol'
        : line.startsWith('>')
          ? 'quote'
          : 'p';

function toBlock(kind: Kind, lines: string[]): Block {
  switch (kind) {
    case 'h': {
      const m = HEADING.exec(lines[0]!)!;
      return { t: 'h', level: m[1]!.length >= 3 ? 3 : 2, c: parseInline(m[2]!.trim()) };
    }
    case 'ul':
      return { t: 'ul', items: lines.map((l) => parseInline(l.replace(BULLET, ''))) };
    case 'ol':
      return { t: 'ol', items: lines.map((l) => parseInline(l.replace(NUMBER, ''))) };
    case 'quote':
      return { t: 'quote', lines: lines.map((l) => parseInline(l.replace(/^>\s?/, ''))) };
    case 'p':
      return { t: 'p', lines: lines.map(parseInline) };
  }
}

/** Splits a paragraph into runs of same-kind lines, so a list or heading needs no blank line before it. */
function block(lines: string[]): Block[] {
  const out: Block[] = [];
  let run: string[] = [];
  let kind: Kind | undefined;
  for (const line of lines) {
    const k = kindOf(line);
    if (kind && (k !== kind || k === 'h')) {
      out.push(toBlock(kind, run));
      run = [];
    }
    kind = k;
    run.push(line);
  }
  if (kind) out.push(toBlock(kind, run));
  return out;
}

export function parseRichText(text: string): Block[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((b) =>
      b
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0)
    .flatMap(block);
}
