import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './ui.module.css';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'brand' | 'accent';

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx(styles.badge, styles[`tone-${tone}`], className)}>{children}</span>;
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Exclude<Tone, 'neutral' | 'brand' | 'accent'>;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(styles.alert, styles[`tone-${tone}`])}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <p className={styles.alertTitle}>{title}</p>
      {children && <div className={styles.alertBody}>{children}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  interactive,
  ...rest
}: HTMLAttributes<HTMLElement> & { interactive?: boolean }) {
  return (
    <article
      className={cx(styles.card, interactive && styles.cardInteractive, className)}
      {...rest}
    >
      {children}
    </article>
  );
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <span className={cx(styles.skeleton, className)} style={{ width, height }} aria-hidden="true" />
  );
}

export function EmptyState({
  title,
  description,
  action,
  as: Heading = 'h2',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** h2 under a page h1 keeps the outline valid; a standalone page (404) passes h1. */
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={styles.empty}>
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="31" cy="15" r="6" fill="var(--color-sun)" />
        <path d="M4 36c9-6 18-7 27-4s9 3 13 0v12H4z" fill="var(--color-border)" />
      </svg>
      <Heading className={styles.emptyTitle}>{title}</Heading>
      {description && <p className={styles.emptyText}>{description}</p>}
      {action}
    </div>
  );
}
