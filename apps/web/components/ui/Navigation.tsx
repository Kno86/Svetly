'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';
import styles from './ui.module.css';

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Навигационная цепочка">
      <ol className={styles.breadcrumbs}>
        {items.map((item, i) => (
          <li key={item.label}>
            {item.href && i < items.length - 1 ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Tabs({
  tabs,
  label,
}: {
  label: string;
  tabs: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const base = useId();
  const [active, setActive] = useState(0);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.tablist}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            id={`${base}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            className={cx(styles.tab, i === active && styles.tabActive)}
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          id={`${base}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className={styles.tabpanel}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

/** Tabs that are links: each tab is its own URL, so they work without JavaScript and keep the back button. */
export function LinkTabs({
  label,
  items,
}: {
  label: string;
  items: Array<{ label: string; href: string; current: boolean }>;
}) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = list.current;
    const current = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    if (ul && current && current.offsetLeft + current.offsetWidth > ul.clientWidth) {
      ul.scrollLeft = current.offsetLeft - ul.offsetLeft - 16;
    }
  }, [items]);
  return (
    <nav aria-label={label}>
      <ul ref={list} className={styles.tablist} role="list">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={cx(styles.tab, styles.tabLink, item.current && styles.tabActive)}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
