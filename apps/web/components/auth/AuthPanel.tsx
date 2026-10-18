import type { ReactNode } from 'react';
import { Card } from '../ui/Feedback';
import styles from './auth.module.css';

export function AuthPanel({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <Card className={styles.panel}>
        <h1>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
        {children}
      </Card>
    </main>
  );
}
