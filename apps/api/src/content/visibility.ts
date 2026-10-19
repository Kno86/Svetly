import type { PrismaService } from '../prisma/prisma.service.js';

/** Entities residents can report or bookmark. */
export const TARGET_TYPES = [
  'announcement',
  'organization',
  'news',
  'event',
  'job',
  'lost_found',
  'group',
  'post',
  'comment',
] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** Posts a viewer may read: general feed and open groups for everyone, closed groups for active members. */
export function visiblePostWhere(userId?: string) {
  return {
    status: 'published',
    OR: [
      { groupId: null },
      { group: { status: 'active', visibility: 'open' } },
      ...(userId
        ? [{ group: { status: 'active', members: { some: { userId, status: 'active' } } } }]
        : []),
    ],
  };
}

/** Server-side check that `id` is currently visible to the viewer (published, not expired, accessible group). */
export async function isVisibleTarget(
  prisma: PrismaService,
  type: TargetType,
  id: string,
  userId?: string,
): Promise<boolean> {
  const pub = { id, status: 'published' };
  const live = { ...pub, expiresAt: { gt: new Date() } };
  switch (type) {
    case 'announcement':
      return (await prisma.announcement.count({ where: live })) > 0;
    case 'job':
      return (await prisma.job.count({ where: live })) > 0;
    case 'lost_found':
      return (await prisma.lostFoundItem.count({ where: live })) > 0;
    case 'organization':
      return (await prisma.organization.count({ where: pub })) > 0;
    case 'news':
      return (await prisma.newsArticle.count({ where: pub })) > 0;
    case 'event':
      return (await prisma.event.count({ where: pub })) > 0;
    case 'group':
      return (await prisma.group.count({ where: { id, status: 'active' } })) > 0;
    case 'post':
      return (await prisma.post.count({ where: { id, ...visiblePostWhere(userId) } })) > 0;
    case 'comment':
      return (
        (await prisma.comment.count({
          where: { id, status: 'published', post: visiblePostWhere(userId) },
        })) > 0
      );
  }
}
