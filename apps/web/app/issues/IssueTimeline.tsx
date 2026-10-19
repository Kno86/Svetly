import { Badge } from '../../components/ui/Feedback';
import { ISSUE_STATUS } from '../../lib/community';
import { formatDate } from '../../lib/content';
import styles from '../../components/content/content.module.css';

export interface IssueUpdateView {
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  body: string;
  createdAt: string;
}

const KIND: Record<string, string> = {
  created: 'Обращение принято',
  status: 'Статус изменён',
  official: 'Ответ платформы',
};

export function IssueTimeline({ updates }: { updates: IssueUpdateView[] }) {
  return (
    <ol className={styles.body}>
      {updates.map((u, i) => (
        <li key={i}>
          <strong>{KIND[u.kind] ?? 'Обновление'}</strong>{' '}
          {u.toStatus && (
            <Badge tone={ISSUE_STATUS[u.toStatus]?.tone}>{ISSUE_STATUS[u.toStatus]?.label}</Badge>
          )}{' '}
          <time dateTime={u.createdAt}>{formatDate(u.createdAt, true)}</time>
          {u.body && <p>{u.body}</p>}
        </li>
      ))}
    </ol>
  );
}

export function IssueRouting() {
  return (
    <>
      Обращение получают сотрудники платформы SVETLY. Мы проверяем его, по возможности уточняем
      детали и сообщаем об изменениях статуса здесь. Автоматической передачи в администрацию посёлка
      или другие органы нет; если ответственная организация известна, сотрудник укажет это в
      комментарии.
    </>
  );
}
