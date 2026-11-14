import { describe, expect, it } from 'vitest';
import { parseInline, parseRichText, safeHref } from './rich-text';

describe('parseRichText', () => {
  it('keeps plain text as paragraphs', () => {
    expect(parseRichText('Первый абзац.\n\nВторой\nс переносом.')).toEqual([
      { t: 'p', lines: [[{ t: 'text', v: 'Первый абзац.' }]] },
      {
        t: 'p',
        lines: [[{ t: 'text', v: 'Второй' }], [{ t: 'text', v: 'с переносом.' }]],
      },
    ]);
  });

  it('parses headings, lists and quotes', () => {
    const blocks = parseRichText(
      '## Итоги\nТекст\n\n- один\n- два\n\n1. первый\n2. второй\n\n> цитата',
    );
    expect(blocks.map((b) => b.t)).toEqual(['h', 'p', 'ul', 'ol', 'quote']);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(parseRichText('### Мелкий')[0]).toMatchObject({ t: 'h', level: 3 });
    expect(parseRichText('# Крупный')[0]).toMatchObject({ t: 'h', level: 2 });
  });

  it('does not treat a mixed block as a list', () => {
    expect(parseRichText('- пункт\nобычная строка')[0]!.t).toBe('p');
  });
});

describe('parseInline', () => {
  it('parses bold, italic and nested formatting', () => {
    expect(parseInline('a **b *c* e** d')).toEqual([
      { t: 'text', v: 'a ' },
      {
        t: 'b',
        c: [
          { t: 'text', v: 'b ' },
          { t: 'i', c: [{ t: 'text', v: 'c' }] },
          { t: 'text', v: ' e' },
        ],
      },
      { t: 'text', v: ' d' },
    ]);
    expect(parseInline('2 * 3 * 4')).toEqual([{ t: 'text', v: '2 * 3 * 4' }]);
  });

  it('links only to http(s) and site paths', () => {
    expect(parseInline('[сайт](https://example.org)')[0]).toMatchObject({
      t: 'a',
      href: 'https://example.org',
    });
    expect(parseInline('[x](/events)')[0]).toMatchObject({ t: 'a', href: '/events' });
    expect(parseInline('[x](javascript:alert(1))')[0]).toMatchObject({ t: 'text' });
    expect(parseInline('[вики](https://ru.wikipedia.org/wiki/A_(b))')[0]).toMatchObject({
      t: 'a',
      href: 'https://ru.wikipedia.org/wiki/A_(b)',
    });
    expect(safeHref('//evil.example')).toBeUndefined();
    expect(safeHref('data:text/html,x')).toBeUndefined();
  });
});
