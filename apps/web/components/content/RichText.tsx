import { Fragment, type ReactNode } from 'react';
import { parseRichText, type Inline } from '../../lib/rich-text';

function inline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={i}>{n.v}</Fragment>;
      case 'b':
        return <strong key={i}>{inline(n.c)}</strong>;
      case 'i':
        return <em key={i}>{inline(n.c)}</em>;
      case 'a':
        return n.href.startsWith('/') ? (
          <a key={i} href={n.href}>
            {inline(n.c)}
          </a>
        ) : (
          <a key={i} href={n.href} rel="nofollow ugc noopener noreferrer" target="_blank">
            {inline(n.c)}
          </a>
        );
    }
  });
}

const lines = (rows: Inline[][]) =>
  rows.map((row, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(row)}
    </Fragment>
  ));

/** Renders text written with the admin editor; plain text becomes paragraphs. */
export function RichText({ text }: { text: string }) {
  return parseRichText(text).map((b, i) => {
    switch (b.t) {
      case 'p':
        return <p key={i}>{lines(b.lines)}</p>;
      case 'quote':
        return (
          <blockquote key={i}>
            <p>{lines(b.lines)}</p>
          </blockquote>
        );
      case 'h':
        return b.level === 2 ? <h2 key={i}>{inline(b.c)}</h2> : <h3 key={i}>{inline(b.c)}</h3>;
      case 'ul':
      case 'ol': {
        const List = b.t;
        return (
          <List key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      }
    }
  });
}
