import Image from 'next/image';
import { cx } from './cx';
import styles from './ui.module.css';

const SIZES = { sm: 32, md: 48, lg: 96 } as const;

/** Profile photo, or the first letter of the name when there is none. Decorative: the name is always shown next to it. */
export function Avatar({
  name,
  avatarId,
  size = 'sm',
  className,
}: {
  name: string;
  avatarId?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  const cls = cx(styles.avatar, styles[`avatar-${size}`], className);
  if (avatarId)
    return (
      <Image
        src={`/api/media/${avatarId}`}
        alt=""
        width={px}
        height={px}
        sizes={`${px}px`}
        className={cls}
      />
    );
  return (
    <span className={cls} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
