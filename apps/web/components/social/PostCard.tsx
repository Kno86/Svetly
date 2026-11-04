'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Badge, Card } from '../ui/Feedback';
import { apiRequest } from '../../lib/auth-client';
import { POST_STATUS } from '../../lib/community';
import { formatDate } from '../../lib/content';
import { hostOf, type FeedPost } from '../../lib/social';
import styles from './social.module.css';

/** One feed post. `detail` hides the link to the discussion page. */
export function PostCard({
  post,
  signedIn,
  detail = false,
}: {
  post: FeedPost;
  signedIn: boolean;
  detail?: boolean;
}) {
  const [liked, setLiked] = useState(post.liked);
  const [count, setCount] = useState(post.reactions);
  const [busy, setBusy] = useState(false);
  const status = POST_STATUS[post.status];

  async function toggle() {
    setBusy(true);
    const r = await apiRequest<{ liked: boolean; reactions: number }>(
      `/api/posts/${post.id}/reaction`,
      { method: liked ? 'DELETE' : 'PUT' },
    );
    setBusy(false);
    if (r.ok && r.data) {
      setLiked(r.data.liked);
      setCount(r.data.reactions);
    }
  }

  return (
    <Card className={styles.post}>
      <div className={styles.meta}>
        <strong>
          {post.author.profileId ? (
            <Link href={`/residents/${post.author.profileId}`}>{post.author.name}</Link>
          ) : (
            post.author.name
          )}
        </strong>
        {post.group && <Link href={`/groups/${post.group.slug}`}>{post.group.name}</Link>}
        <span>{formatDate(post.publishedAt ?? post.createdAt, true)}</span>
        {post.editedAt && <span>изменено</span>}
        {post.pinned && <Badge tone="accent">Закреплено</Badge>}
        {post.status !== 'published' && status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>
      {post.moderationNote && post.status !== 'published' && (
        <p className={styles.meta}>Комментарий модератора: {post.moderationNote}</p>
      )}
      <p className={styles.body}>{post.body}</p>
      {post.link && (
        <a href={post.link} target="_blank" rel="nofollow ugc noopener noreferrer">
          {hostOf(post.link)}
        </a>
      )}
      {post.imageIds.length > 0 && (
        <div className={styles.images}>
          {post.imageIds.map((id, i) => (
            <img key={id} src={`/api/media/${id}`} alt={`Фото ${i + 1}`} loading="lazy" />
          ))}
        </div>
      )}
      {post.status === 'published' && (
        <div className={styles.actions}>
          {signedIn ? (
            <Button
              size="sm"
              variant={liked ? 'primary' : 'secondary'}
              aria-pressed={liked}
              disabled={busy}
              onClick={() => void toggle()}
            >
              Нравится · {count}
            </Button>
          ) : (
            <span className={styles.meta}>Нравится: {count}</span>
          )}
          {!detail && <Link href={`/feed/${post.id}`}>Обсуждение · {post.comments}</Link>}
        </div>
      )}
    </Card>
  );
}
