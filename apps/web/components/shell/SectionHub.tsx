'use client';

import Link from 'next/link';
import { Card } from '../ui/Feedback';
import styles from '../content/content.module.css';
import { useFeatures, visibleWith } from '../../lib/features';

export interface HubItem {
  label: string;
  href: string;
  text: string;
  feature?: string;
}

/** Entry cards to the modules of one top-level section. */
export function SectionHub({ items }: { items: HubItem[] }) {
  const visible = visibleWith(items, useFeatures());
  return (
    <ul className={styles.list} role="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {visible.map((item) => (
        <li key={item.href}>
          <Card interactive>
            <h2 className={styles.cardTitle}>
              <Link href={item.href}>{item.label}</Link>
            </h2>
            <p className={styles.excerpt}>{item.text}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
