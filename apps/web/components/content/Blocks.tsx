import Link from 'next/link';
import type { ReactNode } from 'react';
import { ButtonLink } from '../ui/Button';
import { Alert, Badge, Card, EmptyState } from '../ui/Feedback';
import { Breadcrumbs } from '../ui/Navigation';
import { Select, TextField } from '../ui/Field';
import { Button } from '../ui/Button';
import type { Category } from '../../lib/content';
import { query } from '../../lib/content';
import styles from './content.module.css';

export function PageHead({
  title,
  description,
  crumbs,
  action,
}: {
  title: string;
  description?: string;
  crumbs: Array<{ label: string; href?: string }>;
  action?: ReactNode;
}) {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, ...crumbs]} />
      <div className={styles.head}>
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
    </>
  );
}

/** Plain GET form: works without JavaScript, keeps filters in the URL (shareable, back-button friendly). */
export function Filters({
  action,
  q,
  category,
  categories,
  hidden,
}: {
  action: string;
  q?: string;
  category?: string;
  categories: Category[];
  hidden?: Record<string, string>;
}) {
  return (
    <form method="get" action={action} className={styles.filters} role="search">
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <TextField
        label="Поиск"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Например, велосипед"
      />
      <Select label="Категория" name="category" defaultValue={category ?? ''}>
        <option value="">Все категории</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary">
        Найти
      </Button>
    </form>
  );
}

export function Pager({
  path,
  page,
  total,
  limit,
  params,
}: {
  path: string;
  page: number;
  total: number;
  limit: number;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav className={styles.pager} aria-label="Страницы">
      {page > 1 ? (
        <Link href={`${path}${query({ ...params, page: page - 1 })}`}>← Назад</Link>
      ) : (
        <span />
      )}
      <span>
        Страница {page} из {pages}
      </span>
      {page < pages ? (
        <Link href={`${path}${query({ ...params, page: page + 1 })}`}>Вперёд →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function LoadError() {
  return (
    <Alert tone="error" title="Не удалось загрузить данные">
      Сервис временно недоступен. Обновите страницу через минуту.
    </Alert>
  );
}

export function Empty({
  filtered,
  title,
  description,
  action,
}: {
  filtered: boolean;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return filtered ? (
    <EmptyState title="Ничего не найдено" description="Измените запрос или сбросьте фильтры." />
  ) : (
    <EmptyState title={title} description={description} action={action} />
  );
}

export function ItemCard({
  href,
  title,
  meta,
  children,
  badges,
}: {
  href: string;
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <Card interactive>
      <Link href={href} className={styles.cardLink}>
        {badges && <div className={styles.meta}>{badges}</div>}
        <h3 className={styles.cardTitle}>{title}</h3>
        {children}
        {meta && <div className={styles.meta}>{meta}</div>}
      </Link>
    </Card>
  );
}

export function DemoBadge({ show }: { show: boolean }) {
  return show ? <Badge tone="warning">демо</Badge> : null;
}

export { ButtonLink, styles };
