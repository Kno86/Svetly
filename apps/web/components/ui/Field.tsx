import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';
import styles from './ui.module.css';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, required, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({
  label,
  hint,
  error,
  id,
  className,
  required,
  ...rest
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <input
        id={fieldId}
        className={cx(styles.control, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        required={required}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  className,
  required,
  ...rest
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={fieldId}
        className={cx(styles.control, styles.textarea, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        required={required}
        {...rest}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  className,
  required,
  children,
  ...rest
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <select
        id={fieldId}
        className={cx(styles.control, styles.select, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        required={required}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={cx(styles.choice, className)}>
      <input type="checkbox" className={styles.checkbox} {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({
  label,
  className,
  ...rest
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={cx(styles.choice, className)}>
      <input type="radio" className={styles.radio} {...rest} />
      <span>{label}</span>
    </label>
  );
}
