/** Labels, types and pure helpers for PHASE 7 social modules (groups, feed, favorites). */
export const GROUP_TOPICS: Record<string, string> = {
  neighbors: 'Соседи',
  parents: 'Родители',
  sport: 'Спорт',
  auto: 'Автомобили',
  animals: 'Животные',
  help: 'Взаимопомощь',
  hobby: 'Хобби',
  services: 'Местные услуги',
  other: 'Другое',
};

export const GROUP_VISIBILITY: Record<string, string> = {
  open: 'Открытая: материалы видят все, вступить может любой житель',
  closed: 'Закрытая: материалы видят только участники, вступление после одобрения',
};

export const MEMBER_ROLE: Record<string, string> = {
  owner: 'Владелец',
  moderator: 'Модератор',
  member: 'Участник',
};

export const MEMBER_STATUS: Record<string, string> = {
  active: 'Участник',
  pending: 'Заявка на вступление',
  banned: 'Заблокирован',
};

export interface FeedPost {
  id: string;
  groupId: string | null;
  body: string;
  link: string | null;
  imageIds: string[];
  status: string;
  moderationNote?: string | null;
  pinned: boolean;
  publishedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  /** `profileId` is set only when the author made their profile public. */
  author: { name: string; profileId: string | null };
  group: { slug: string; name: string; visibility: string } | null;
  mine: boolean;
  reactions: number;
  comments: number;
  liked: boolean;
}

export interface FeedPage {
  items: FeedPost[];
  nextCursor: string | null;
}

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { name: string };
  mine: boolean;
}

/** Top-level comments with their replies, in chronological order. */
export function threadComments(
  list: CommentView[],
): Array<CommentView & { replies: CommentView[] }> {
  const roots = list
    .filter((c) => !c.parentId)
    .map((c) => ({ ...c, replies: [] as CommentView[] }));
  const byId = new Map(roots.map((r) => [r.id, r]));
  for (const c of list) if (c.parentId) byId.get(c.parentId)?.replies.push(c);
  return roots;
}

/** Appends a page without duplicates (a post may shift between pages while reading). */
export function mergePages(current: FeedPost[], next: FeedPost[]): FeedPost[] {
  const seen = new Set(current.map((p) => p.id));
  return [...current, ...next.filter((p) => !seen.has(p.id))];
}

export function excerpt(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
