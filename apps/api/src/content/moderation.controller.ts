import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Authenticated, CurrentPrincipal } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type QueueKind = 'announcements' | 'jobs' | 'lost-found' | 'posts' | 'groups';

export interface QueueItem {
  kind: QueueKind;
  id: string;
  title: string;
  excerpt: string;
  createdAt: Date;
}

const PER_KIND = 50;
const pending = {
  where: { status: 'pending' },
  orderBy: { createdAt: 'asc' as const },
  take: PER_KIND,
};
const excerpt = (text: string) => (text.length > 280 ? `${text.slice(0, 279)}…` : text);

/** One oldest-first list of everything awaiting a decision that the caller may moderate. */
@Controller()
export class ModerationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('moderation/queue')
  @Authenticated()
  async queue(@CurrentPrincipal() p: Principal) {
    const announcements = p.permissions.has('moderation.announcements');
    const community = p.permissions.has('moderation.community');
    if (!announcements && !community)
      throw new HttpException({ code: 'FORBIDDEN' }, HttpStatus.FORBIDDEN);

    const sources: Array<Promise<{ kind: QueueKind; total: number; items: QueueItem[] }>> = [];
    const add = <T>(
      kind: QueueKind,
      count: Promise<number>,
      rows: Promise<T[]>,
      map: (row: T) => Omit<QueueItem, 'kind'>,
    ) =>
      sources.push(
        Promise.all([count, rows]).then(([total, list]) => ({
          kind,
          total,
          items: list.map((r) => ({ kind, ...map(r) })),
        })),
      );
    const text = { id: true, title: true, description: true, createdAt: true } as const;
    const fromText = (r: { id: string; title: string; description: string; createdAt: Date }) => ({
      id: r.id,
      title: r.title,
      excerpt: excerpt(r.description),
      createdAt: r.createdAt,
    });

    if (announcements)
      add(
        'announcements',
        this.prisma.announcement.count({ where: pending.where }),
        this.prisma.announcement.findMany({ ...pending, select: text }),
        fromText,
      );
    if (community) {
      add(
        'jobs',
        this.prisma.job.count({ where: pending.where }),
        this.prisma.job.findMany({ ...pending, select: text }),
        fromText,
      );
      add(
        'lost-found',
        this.prisma.lostFoundItem.count({ where: pending.where }),
        this.prisma.lostFoundItem.findMany({ ...pending, select: text }),
        fromText,
      );
      add(
        'posts',
        this.prisma.post.count({ where: pending.where }),
        this.prisma.post.findMany({
          ...pending,
          select: { id: true, body: true, createdAt: true, group: { select: { name: true } } },
        }),
        (r) => ({
          id: r.id,
          title: r.group ? `Пост в группе «${r.group.name}»` : 'Пост в ленте',
          excerpt: excerpt(r.body),
          createdAt: r.createdAt,
        }),
      );
      add(
        'groups',
        this.prisma.group.count({ where: pending.where }),
        this.prisma.group.findMany({
          ...pending,
          select: { id: true, name: true, description: true, createdAt: true },
        }),
        (r) => ({
          id: r.id,
          title: r.name,
          excerpt: excerpt(r.description),
          createdAt: r.createdAt,
        }),
      );
    }

    const results = await Promise.all(sources);
    return {
      counts: Object.fromEntries(results.map((r) => [r.kind, r.total])) as Partial<
        Record<QueueKind, number>
      >,
      items: results
        .flatMap((r) => r.items)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    };
  }
}
