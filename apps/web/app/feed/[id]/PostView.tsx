'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageHead, styles } from '../../../components/content/Blocks';
import { FavoriteButton } from '../../../components/content/FavoriteButton';
import { ReportButton } from '../../../components/content/ReportButton';
import { PostCard } from '../../../components/social/PostCard';
import social from '../../../components/social/social.module.css';
import { Button } from '../../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { TextArea } from '../../../components/ui/Field';
import { apiRequest, errorMessage } from '../../../lib/auth-client';
import { formatDate } from '../../../lib/content';
import { threadComments, type CommentView, type FeedPost } from '../../../lib/social';

interface PostDetail extends FeedPost {
  canModerate: boolean;
  canComment: boolean;
  commentList: CommentView[];
}

export function PostView({ id }: { id: string }) {
  const [post, setPost] = useState<PostDetail | null>();
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const [r, me] = await Promise.all([
      apiRequest<PostDetail>(`/api/posts/${id}`),
      apiRequest('/api/me'),
    ]);
    setSignedIn(me.ok);
    setPost(r.ok && r.data ? r.data : null);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    const r = await apiRequest(path, { method, body });
    if (!r.ok) return setError(errorMessage(r));
    setError(undefined);
    await load();
  }
  function withNote(path: string) {
    const note = window.prompt('Причина (её увидит автор):');
    if (note && note.trim().length >= 3) void act(path, 'POST', { note: note.trim() });
  }

  if (post === undefined)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <Skeleton height="10rem" />
      </main>
    );
  if (post === null)
    return (
      <main id="main" className={`container ${styles.page}`}>
        <EmptyState
          title="Пост не найден"
          description="Он удалён, ещё не прошёл проверку или доступен только участникам закрытой группы."
        />
      </main>
    );

  const editPost = () => {
    const body = window.prompt('Текст поста', post.body);
    if (body && body.trim().length >= 2)
      void act(`/api/posts/${id}`, 'PATCH', { body, link: post.link });
  };
  return (
    <main id="main" className={`container ${styles.page}`}>
      <PageHead
        title="Обсуждение"
        crumbs={[{ label: 'Лента', href: '/feed' }, { label: 'Обсуждение' }]}
      />
      {error && <Alert tone="error" title={error} />}
      <PostCard post={post} signedIn={signedIn} detail />
      <div className={social.actions}>
        {post.status === 'published' && signedIn && (
          <FavoriteButton entityType="post" entityId={id} />
        )}
        {post.status === 'published' && !post.mine && (
          <ReportButton entityType="post" entityId={id} />
        )}
        {post.mine && (
          <>
            <Button size="sm" variant="secondary" onClick={editPost}>
              Изменить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                window.confirm('Удалить пост?') && void act(`/api/posts/${id}`, 'DELETE')
              }
            >
              Удалить
            </Button>
          </>
        )}
        {post.canModerate && post.group && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void act(`/api/posts/${id}/pin`, 'POST', {})}
          >
            {post.pinned ? 'Открепить' : 'Закрепить'}
          </Button>
        )}
        {post.canModerate && post.status === 'published' && (
          <Button size="sm" variant="ghost" onClick={() => withNote(`/api/posts/${id}/remove`)}>
            Снять пост
          </Button>
        )}
      </div>
      {post.status === 'published' && (
        <section className={social.comments} aria-label="Комментарии">
          <h2>Комментарии · {post.commentList.length}</h2>
          {post.canComment && (
            <CommentForm onSubmit={(body) => act(`/api/posts/${id}/comments`, 'POST', { body })} />
          )}
          {!post.commentList.length && <p>Комментариев пока нет.</p>}
          {threadComments(post.commentList).map((c) => (
            <div key={c.id} className={social.comment}>
              <Comment c={c} post={post} act={act} withNote={withNote} />
              <div className={social.replies}>
                {c.replies.map((r) => (
                  <div key={r.id} className={social.comment}>
                    <Comment c={r} post={post} act={act} withNote={withNote} />
                  </div>
                ))}
                {post.canComment && (
                  <details>
                    <summary>Ответить</summary>
                    <CommentForm
                      onSubmit={(body) =>
                        act(`/api/posts/${id}/comments`, 'POST', { body, parentId: c.id })
                      }
                    />
                  </details>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function Comment({
  c,
  post,
  act,
  withNote,
}: {
  c: CommentView;
  post: PostDetail;
  act: (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => Promise<void>;
  withNote: (path: string) => void;
}) {
  return (
    <>
      <div className={social.meta}>
        <strong>{c.author.name}</strong>
        <span>{formatDate(c.createdAt, true)}</span>
        {c.editedAt && <span>изменено</span>}
      </div>
      <p className={social.body}>{c.body}</p>
      <div className={social.actions}>
        {c.mine && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const body = window.prompt('Комментарий', c.body);
                if (body?.trim()) void act(`/api/comments/${c.id}`, 'PATCH', { body });
              }}
            >
              Изменить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void act(`/api/comments/${c.id}`, 'DELETE')}
            >
              Удалить
            </Button>
          </>
        )}
        {!c.mine && <ReportButton entityType="comment" entityId={c.id} />}
        {post.canModerate && !c.mine && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => withNote(`/api/comments/${c.id}/remove`)}
          >
            Снять
          </Button>
        )}
      </div>
    </>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSubmit(body);
    setBusy(false);
    setBody('');
  }
  return (
    <form className={social.composer} onSubmit={(e) => void submit(e)}>
      <TextArea
        label="Комментарий"
        name="comment"
        required
        maxLength={2000}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div>
        <Button type="submit" size="sm" loading={busy}>
          Отправить
        </Button>
      </div>
    </form>
  );
}
