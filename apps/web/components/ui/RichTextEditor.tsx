'use client';

import { useRef, useState } from 'react';
import { RichText } from '../content/RichText';
import { TextArea } from './Field';
import styles from './ui.module.css';

type Action = { label: string; title: string; wrap?: [string, string]; line?: string };

const ACTIONS: Action[] = [
  { label: 'H', title: 'Подзаголовок', line: '## ' },
  { label: 'Ж', title: 'Жирный', wrap: ['**', '**'] },
  { label: 'К', title: 'Курсив', wrap: ['*', '*'] },
  { label: '•', title: 'Список', line: '- ' },
  { label: '1.', title: 'Нумерованный список', line: '1. ' },
  { label: '❝', title: 'Цитата', line: '> ' },
  { label: 'Ссылка', title: 'Ссылка', wrap: ['[', '](https://)'] },
];

/** Textarea with a formatting toolbar and preview; stores the lightweight markup from `lib/rich-text`. */
export function RichTextEditor({
  label,
  hint,
  required,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function apply(a: Action) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    let next: string;
    let caret: [number, number];
    if (a.wrap) {
      const [open, close] = a.wrap;
      const inner = value.slice(start, end) || 'текст';
      next = value.slice(0, start) + open + inner + close + value.slice(end);
      caret =
        a.title === 'Ссылка'
          ? [start + open.length + inner.length + 2, start + open.length + inner.length + 10]
          : [start + open.length, start + open.length + inner.length];
    } else {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lines = value.slice(lineStart, end).split('\n');
      const prefixed = lines
        .map((l, i) => (a.line === '1. ' ? `${i + 1}. ` : a.line) + l)
        .join('\n');
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      caret = [lineStart + prefixed.length, lineStart + prefixed.length];
    }
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(...caret);
    });
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorToolbar} role="toolbar" aria-label={`Оформление: ${label}`}>
        {ACTIONS.map((a) => (
          <button
            key={a.title}
            type="button"
            title={a.title}
            aria-label={a.title}
            disabled={preview}
            onClick={() => apply(a)}
          >
            {a.label}
          </button>
        ))}
        <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>
          {preview ? 'Редактировать' : 'Предпросмотр'}
        </button>
      </div>
      {preview ? (
        <div className={styles.editorPreview} aria-label={`Предпросмотр: ${label}`}>
          {value.trim() ? <RichText text={value} /> : <p>Пока пусто.</p>}
        </div>
      ) : (
        <TextArea
          ref={ref}
          label={label}
          hint={
            hint ??
            'Абзацы разделяйте пустой строкой. ## — подзаголовок, **жирный**, *курсив*, - список.'
          }
          required={required}
          rows={12}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
