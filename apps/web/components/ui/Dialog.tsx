'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { TextArea } from './Field';
import styles from './ui.module.css';

/** Confirmation dialog built on the native <dialog> element (focus trap, Esc to close). */
export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
}: {
  triggerLabel: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant={danger ? 'danger' : 'secondary'} onClick={() => ref.current?.showModal()}>
        {triggerLabel}
      </Button>
      <dialog ref={ref} className={styles.dialog} aria-labelledby="dialog-title">
        <h3 id="dialog-title">{title}</h3>
        <div className={styles.dialogBody}>{description}</div>
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            Отмена
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm?.();
              ref.current?.close();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}

export interface AskOptions {
  title: string;
  description?: ReactNode;
  /** Label of a required text field; without it the dialog is a plain confirmation. */
  field?: string;
  defaultValue?: string;
  confirmLabel?: string;
  danger?: boolean;
}

/**
 * Promise-based replacement for window.prompt/confirm: `await ask(...)` resolves to the entered
 * text ('' for a confirmation) or undefined when cancelled. Render the returned node once.
 */
export function useAsk(): [ReactNode, (options: AskOptions) => Promise<string | undefined>] {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((value: string | undefined) => void) | undefined>(undefined);
  const [options, setOptions] = useState<AskOptions>();
  const [value, setValue] = useState('');
  const titleId = useId();

  useEffect(() => {
    if (options && ref.current && !ref.current.open) ref.current.showModal();
  }, [options]);

  const ask = useCallback(
    (next: AskOptions) =>
      new Promise<string | undefined>((resolve) => {
        resolver.current?.(undefined);
        resolver.current = resolve;
        setValue(next.defaultValue ?? '');
        setOptions(next);
      }),
    [],
  );

  function finish(result: string | undefined) {
    resolver.current?.(result);
    resolver.current = undefined;
    if (ref.current?.open) ref.current.close();
    setOptions(undefined);
  }

  const node = options ? (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => finish(undefined)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          finish(options.field ? value.trim() : '');
        }}
      >
        <h3 id={titleId}>{options.title}</h3>
        {options.description && <div className={styles.dialogBody}>{options.description}</div>}
        {options.field && (
          <div className={styles.dialogBody}>
            <TextArea
              label={options.field}
              rows={3}
              maxLength={2000}
              required
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={() => finish(undefined)}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant={options.danger ? 'danger' : 'primary'}
            disabled={Boolean(options.field) && !value.trim()}
          >
            {options.confirmLabel ?? 'Подтвердить'}
          </Button>
        </div>
      </form>
    </dialog>
  ) : null;

  return [node, ask];
}
