'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { checkImage } from '../../../components/content/AnnouncementForm';
import { ReportButton } from '../../../components/content/ReportButton';
import css from '../../../components/messages/messages.module.css';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { TextArea } from '../../../components/ui/Field';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';
import {
  dropDelivered,
  MAX_MESSAGE_IMAGES,
  MAX_MESSAGE_LENGTH,
  mergeMessages,
  newClientId,
  POLL_INTERVAL_MS,
  type ChatMessage,
  type ConversationInfo,
  type OutgoingMessage,
} from '../../../lib/messages';

interface History {
  items: ChatMessage[];
  nextBefore: string | null;
}

export function ConversationView({ id }: { id: string }) {
  const [info, setInfo] = useState<ConversationInfo | null | 'auth'>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([]);
  const [checkedAt, setCheckedAt] = useState<Date>();
  const [pollFailed, setPollFailed] = useState(false);
  const [error, setError] = useState<string>();
  const latest = useRef<string | undefined>(undefined);

  const markRead = useCallback(
    () => apiRequest(`/api/conversations/${id}/read`, { body: {} }),
    [id],
  );

  const apply = useCallback((incoming: ChatMessage[]) => {
    setMessages((cur) => {
      const merged = mergeMessages(cur, incoming);
      latest.current = merged[merged.length - 1]?.id;
      return merged;
    });
    setOutgoing((out) => dropDelivered(out, incoming));
  }, []);

  const refreshInfo = useCallback(async () => {
    const r = await apiRequest<ConversationInfo>(`/api/conversations/${id}`);
    setInfo(r.status === 401 ? 'auth' : r.ok && r.data ? r.data : null);
    return r.ok;
  }, [id]);

  const load = useCallback(async () => {
    if (!(await refreshInfo())) return;
    const r = await apiRequest<History>(`/api/conversations/${id}/messages`);
    if (!r.ok || !r.data) return setError(errorMessage(r));
    apply(r.data.items);
    setOlderCursor(r.data.nextBefore);
    setCheckedAt(new Date());
    void markRead();
  }, [id, apply, markRead, refreshInfo]);

  const poll = useCallback(async () => {
    const after = latest.current;
    const r = await apiRequest<History>(
      `/api/conversations/${id}/messages${after ? `?after=${after}` : ''}`,
    );
    if (!r.ok || !r.data) return setPollFailed(true);
    setPollFailed(false);
    setCheckedAt(new Date());
    if (r.data.items.length) {
      apply(r.data.items);
      if (r.data.items.some((m) => !m.mine)) void markRead();
    }
  }, [id, apply, markRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!info || info === 'auth') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [info, poll]);

  async function loadOlder() {
    if (!olderCursor) return;
    const r = await apiRequest<History>(`/api/conversations/${id}/messages?before=${olderCursor}`);
    if (!r.ok || !r.data) return setError(errorMessage(r));
    apply(r.data.items);
    setOlderCursor(r.data.nextBefore);
  }

  async function deliver(msg: OutgoingMessage) {
    setOutgoing((out) => [
      ...out.filter((o) => o.clientId !== msg.clientId),
      { ...msg, state: 'sending', error: undefined },
    ]);
    const r = await apiRequest<ChatMessage>(`/api/conversations/${id}/messages`, {
      body: { body: msg.body, mediaIds: msg.mediaIds, clientId: msg.clientId },
    });
    if (r.ok && r.data) {
      const sent = r.data;
      apply([sent]);
      setOutgoing((out) => out.filter((o) => o.clientId !== msg.clientId));
      return true;
    }
    setOutgoing((out) =>
      out.map((o) =>
        o.clientId === msg.clientId ? { ...o, state: 'failed', error: errorMessage(r) } : o,
      ),
    );
    if (r.code === 'MESSAGING_BLOCKED') void refreshInfo();
    return false;
  }

  async function remove(messageId: string) {
    if (!window.confirm('Удалить сообщение у обоих собеседников?')) return;
    const r = await apiRequest(`/api/messages/${messageId}`, { method: 'DELETE' });
    if (!r.ok) return setError(errorMessage(r));
    setMessages((cur) =>
      cur.map((m) => (m.id === messageId ? { ...m, deleted: true, body: '', mediaIds: [] } : m)),
    );
  }

  async function toggleBlock(current: ConversationInfo) {
    if (!current.other) return;
    if (
      !current.blockedByMe &&
      !window.confirm('Заблокировать собеседника? Вы оба не сможете писать в этой переписке.')
    )
      return;
    const r = await apiRequest(`/api/users/${current.other.id}/block`, {
      method: current.blockedByMe ? 'DELETE' : 'POST',
      body: current.blockedByMe ? undefined : {},
    });
    if (!r.ok) return setError(errorMessage(r));
    setError(undefined);
    await refreshInfo();
  }

  if (info === undefined)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <Skeleton height="12rem" />
      </main>
    );
  if (info === 'auth' || info === null)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <EmptyState
          title={info === 'auth' ? 'Войдите, чтобы читать сообщения' : 'Переписка не найдена'}
          description={
            info === 'auth' ? undefined : 'Её не существует или вы не участвуете в этой переписке.'
          }
          action={
            <ButtonLink href={info === 'auth' ? '/login' : '/messages'}>
              {info === 'auth' ? 'Войти' : 'К сообщениям'}
            </ButtonLink>
          }
        />
      </main>
    );

  const name = info.other?.name ?? 'Пользователь';
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title={name}
        description="Новые сообщения подгружаются примерно раз в 15 секунд, пока страница открыта. Мгновенная доставка не гарантируется."
        crumbs={[
          { label: 'Кабинет', href: '/account' },
          { label: 'Сообщения', href: '/messages' },
          { label: name },
        ]}
        action={
          <Button size="sm" variant="ghost" onClick={() => void toggleBlock(info)}>
            {info.blockedByMe ? 'Разблокировать' : 'Заблокировать'}
          </Button>
        }
      />
      {error && <Alert tone="error" title={error} />}
      <div className={css.row}>
        <span className={css.time} aria-live="polite">
          {pollFailed
            ? 'Не удалось проверить новые сообщения, повторим позже.'
            : checkedAt
              ? `Проверено в ${checkedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
        </span>
        <Button size="sm" variant="secondary" onClick={() => void poll()}>
          Обновить
        </Button>
      </div>
      {olderCursor && (
        <Button size="sm" variant="ghost" onClick={() => void loadOlder()}>
          Показать более ранние
        </Button>
      )}
      <section className={css.thread} aria-label="История сообщений">
        {!messages.length && !outgoing.length && <p>Сообщений пока нет.</p>}
        {messages.map((m) => (
          <article key={m.id} className={`${css.bubble} ${m.mine ? css.mine : ''}`}>
            <span className={css.time}>
              {m.mine ? 'Вы' : name} · {formatDate(m.createdAt, true)}
            </span>
            {m.deleted ? (
              <p className={css.deleted}>Сообщение удалено</p>
            ) : (
              <>
                {m.body && <p className={css.body}>{m.body}</p>}
                <Images ids={m.mediaIds} />
                <div className={css.row}>
                  {m.mine ? (
                    <Button size="sm" variant="ghost" onClick={() => void remove(m.id)}>
                      Удалить
                    </Button>
                  ) : (
                    <ReportButton entityType="message" entityId={m.id} />
                  )}
                </div>
              </>
            )}
          </article>
        ))}
        {outgoing.map((o) => (
          <article key={o.clientId} className={`${css.bubble} ${css.mine}`}>
            <span className={css.time}>
              {o.state === 'sending' ? 'Отправляется…' : 'Не отправлено'}
            </span>
            {o.body && <p className={css.body}>{o.body}</p>}
            <Images ids={o.mediaIds} />
            {o.state === 'failed' && (
              <>
                <Alert tone="error" title={o.error ?? 'Не удалось отправить'} />
                <div className={css.row}>
                  <Button size="sm" onClick={() => void deliver(o)}>
                    Повторить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setOutgoing((out) => out.filter((x) => x.clientId !== o.clientId))
                    }
                  >
                    Отменить
                  </Button>
                </div>
              </>
            )}
          </article>
        ))}
      </section>
      {info.canSend ? (
        <MessageComposer onSend={deliver} />
      ) : (
        <Alert
          tone="info"
          title={
            info.blockedByMe
              ? 'Вы заблокировали собеседника. Разблокируйте, чтобы продолжить переписку.'
              : 'Отправка сообщений в этой переписке недоступна.'
          }
        />
      )}
    </main>
  );
}

function Images({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className={css.images}>
      {ids.map((mediaId, i) => (
        <img key={mediaId} src={`/api/media/${mediaId}`} alt={`Фото ${i + 1}`} loading="lazy" />
      ))}
    </div>
  );
}

function MessageComposer({ onSend }: { onSend: (m: OutgoingMessage) => Promise<boolean> }) {
  const [body, setBody] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string>();

  async function upload(files: FileList | null) {
    setUploading(true);
    for (const file of Array.from(files ?? []).slice(0, MAX_MESSAGE_IMAGES - mediaIds.length)) {
      const problem = checkImage(file);
      if (problem) {
        setNotice(problem);
        break;
      }
      const r = await apiRequest<{ id: string }>('/api/media?scope=private', { file });
      if (!r.ok || !r.data) {
        setNotice(errorMessage(r));
        break;
      }
      const uploaded = r.data.id;
      setMediaIds((cur) => [...cur, uploaded]);
    }
    setUploading(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text && !mediaIds.length) return setNotice('Напишите сообщение или прикрепите фото.');
    setNotice(undefined);
    setBody('');
    setMediaIds([]);
    void onSend({ clientId: newClientId(), body: text, mediaIds, state: 'sending' });
  }

  return (
    <form className={css.composer} onSubmit={submit}>
      <TextArea
        label="Сообщение"
        name="message"
        maxLength={MAX_MESSAGE_LENGTH}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        hint="Фото в сообщениях видите только вы и собеседник."
      />
      <label>
        Фото (до {MAX_MESSAGE_IMAGES}, JPEG/PNG/WebP){' '}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || mediaIds.length >= MAX_MESSAGE_IMAGES}
          onChange={(e) => void upload(e.target.files)}
        />
      </label>
      <Images ids={mediaIds} />
      {notice && <Alert tone="error" title={notice} />}
      <div>
        <Button type="submit" disabled={uploading}>
          Отправить
        </Button>
      </div>
    </form>
  );
}
