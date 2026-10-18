'use client';

import { useRef, type ReactNode } from 'react';
import { Button } from './Button';
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
