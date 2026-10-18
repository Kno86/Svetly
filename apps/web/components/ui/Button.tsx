import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Common {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

export function buttonClass(
  { variant = 'primary', size = 'md', fullWidth }: Common,
  extra?: string,
) {
  return cx(
    styles.button,
    styles[`button-${variant}`],
    styles[`button-${size}`],
    fullWidth && styles.full,
    extra,
  );
}

export function Button({
  variant,
  size,
  loading = false,
  icon,
  fullWidth,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, fullWidth }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}

export type ButtonLinkProps = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function ButtonLink({
  variant,
  size,
  icon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={buttonClass({ variant, size, fullWidth }, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </a>
  );
}
