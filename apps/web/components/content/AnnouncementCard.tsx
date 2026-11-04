import Link from 'next/link';
import { formatDate, formatPrice } from '../../lib/content';
import { Badge } from '../ui/Feedback';
import { MediaImage } from './MediaImage';
import styles from './content.module.css';

export interface AnnouncementCardData {
  slug: string;
  title: string;
  excerpt: string;
  price: number | null;
  condition?: string | null;
  area: string | null;
  coverId: string | null;
  photoCount: number;
  publishedAt: string;
  isDemo: boolean;
  category: { name: string } | null;
}

/** Whole card is one link: photo (or an honest «без фото» placeholder), price, title, short description. */
export function AnnouncementCard({
  a,
  heading = 'h3',
}: {
  a: AnnouncementCardData;
  heading?: 'h2' | 'h3';
}) {
  const Title = heading;
  return (
    <article className={styles.adCard}>
      <Link href={`/announcements/${a.slug}`} className={styles.adLink}>
        <div className={styles.adPhoto}>
          {a.coverId ? (
            <MediaImage id={a.coverId} alt="" variant="card" />
          ) : (
            <span className={styles.adNoPhoto}>Без фото</span>
          )}
          {a.photoCount > 1 && <span className={styles.adCount}>{a.photoCount} фото</span>}
        </div>
        <div className={styles.adBody}>
          <p className={styles.adPrice}>{formatPrice(a.price)}</p>
          <Title className={styles.adTitle}>{a.title}</Title>
          {a.excerpt && <p className={styles.adExcerpt}>{a.excerpt}</p>}
          <div className={styles.adMeta}>
            {a.category && <Badge>{a.category.name}</Badge>}
            {a.condition && <Badge>{a.condition === 'new' ? 'Новое' : 'Б/у'}</Badge>}
            {a.isDemo && <Badge tone="warning">демо</Badge>}
          </div>
          <p className={styles.adFoot}>
            {a.area && <span>{a.area}</span>}
            <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
          </p>
        </div>
      </Link>
    </article>
  );
}
