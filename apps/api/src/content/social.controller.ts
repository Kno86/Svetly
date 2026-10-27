import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import {
  Authenticated,
  CurrentPrincipal,
  OptionalAuth,
  OptionalPrincipal,
  RequirePermission,
} from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isTrustedAuthor } from './community.controller.js';
import { NotificationsService } from './notifications.controller.js';
import { uniqueSlug } from './slug.js';
import { visiblePostWhere } from './visibility.js';

export const GROUP_TOPICS = [
  'neighbors',
  'parents',
  'sport',
  'auto',
  'animals',
  'help',
  'hobby',
  'services',
  'other',
] as const;
export const FEED_PAGE = 20;
const MAX_PENDING_POSTS = 5;
const MAX_PENDING_GROUPS = 2;
export const COMMENT_LIMIT = { count: 10, windowMs: 10 * 60_000 };
const MANAGERS = ['owner', 'moderator'];

const groupBody = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(2000),
  rules: z.string().trim().max(3000).default(''),
  topic: z.enum(GROUP_TOPICS),
  visibility: z.enum(['open', 'closed']).default('open'),
});
const groupPatch = groupBody.omit({ name: true }).partial();
const groupQuery = z.object({
  q: z.string().trim().max(100).optional(),
  topic: z.enum(GROUP_TOPICS).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
const link = z
  .url({ protocol: /^https?$/ })
  .max(500)
  .nullable()
  .optional();
const postBody = z.object({
  groupId: z.uuid().nullable().optional(),
  body: z.string().trim().min(2).max(5000),
  link,
  imageIds: z.array(z.uuid()).max(6).default([]),
});
const postPatch = z.object({ body: z.string().trim().min(2).max(5000), link });
const feedQuery = z.object({
  scope: z.enum(['all', 'groups']).default('all'),
  cursor: z.uuid().optional(),
});
const cursorQuery = z.object({ cursor: z.uuid().optional() });
const commentBody = z.object({
  body: z.string().trim().min(1).max(2000),
  parentId: z.uuid().nullable().optional(),
});
const noteBody = z.object({ note: z.string().trim().min(3).max(1000) });
const statusQuery = z.object({
  status: z.enum(['pending', 'published', 'rejected', 'removed', 'active']).default('pending'),
});
const memberAction = z.enum(['approve', 'ban', 'unban', 'promote', 'demote', 'remove']);

const authorSelect = { select: { name: true } } as const;
const postSelect = {
  id: true,
  groupId: true,
  authorId: true,
  body: true,
  link: true,
  imageIds: true,
  status: true,
  moderationNote: true,
  pinned: true,
  publishedAt: true,
  editedAt: true,
  createdAt: true,
  author: authorSelect,
  group: { select: { slug: true, name: true, visibility: true } },
  _count: { select: { reactions: true, comments: { where: { status: 'published' } } } },
} as const;
type PostRow = {
  id: string;
  authorId: string;
  status: string;
  moderationNote: string | null;
  _count: { reactions: number; comments: number };
} & Record<string, unknown>;

/** Strips author ids and moderation data; adds viewer-specific flags. */
function present(row: PostRow, viewer?: string, liked?: Set<string>) {
  const { authorId, moderationNote, _count, ...rest } = row;
  const mine = viewer === authorId;
  return {
    ...rest,
    ...(mine ? { moderationNote } : {}),
    mine,
    reactions: _count.reactions,
    comments: _count.comments,
    liked: liked?.has(row.id) ?? false,
  };
}

function page<T extends { id: string }>(rows: T[]) {
  const more = rows.length > FEED_PAGE;
  const items = more ? rows.slice(0, FEED_PAGE) : rows;
  return { items, nextCursor: more ? items[items.length - 1]!.id : null };
}

const cursorArgs = (cursor?: string): { cursor?: { id: string }; skip?: number } =>
  cursor ? { cursor: { id: cursor }, skip: 1 } : {};

/** Groups, feed, comments and reactions (PHASE 7a). Every access rule is enforced here. */
@Controller()
export class SocialController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- groups
  @Get('groups')
  async groups(@Query() query: unknown) {
    const { q, topic, page: n } = parse(groupQuery, query);
    const where = {
      status: 'active',
      ...(topic ? { topic } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const size = 20;
    const [total, rows] = await Promise.all([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (n - 1) * size,
        take: size,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          topic: true,
          visibility: true,
          createdAt: true,
          _count: { select: { members: { where: { status: 'active' } } } },
        },
      }),
    ]);
    return {
      items: rows.map(({ _count, ...g }) => ({ ...g, members: _count.members })),
      total,
      page: n,
      limit: size,
    };
  }

  @Get('groups/:slug')
  @OptionalAuth()
  async group(@Param('slug') slug: string, @OptionalPrincipal() p?: Principal) {
    const g = await this.prisma.group.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        rules: true,
        topic: true,
        visibility: true,
        status: true,
        moderationNote: true,
        createdAt: true,
        _count: { select: { members: { where: { status: 'active' } } } },
      },
    });
    if (!g) throw new NotFoundException({ code: 'NOT_FOUND' });
    const membership = p ? await this.membership(g.id, p.userId) : null;
    const { _count, moderationNote, ...rest } = g;
    if (g.status !== 'active' && membership?.role !== 'owner')
      throw new NotFoundException({ code: 'NOT_FOUND' });
    return {
      ...rest,
      ...(membership?.role === 'owner' ? { moderationNote } : {}),
      members: _count.members,
      membership: membership ? { role: membership.role, status: membership.status } : null,
      canRead: g.visibility === 'open' || membership?.status === 'active',
    };
  }

  @Post('groups')
  @Authenticated()
  @HttpCode(201)
  async createGroup(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(groupBody, body);
    const pending = await this.prisma.group.count({
      where: { createdById: p.userId, status: 'pending' },
    });
    if (pending >= MAX_PENDING_GROUPS)
      throw new HttpException(
        { code: 'TOO_MANY_PENDING', message: 'Дождитесь проверки уже созданных групп' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const g = await this.prisma.group.create({
      data: {
        ...data,
        slug: uniqueSlug(data.name),
        createdById: p.userId,
        members: { create: { userId: p.userId, role: 'owner', status: 'active' } },
      },
      select: { id: true, slug: true, status: true },
    });
    await this.log('group.created', p.userId, 'group', g.id);
    return g;
  }

  @Patch('groups/:slug')
  @Authenticated()
  async updateGroup(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(groupPatch, body);
    const g = await this.managedGroup(slug, p.userId, ['owner']);
    await this.prisma.group.update({ where: { id: g.id }, data });
    await this.log('group.updated', p.userId, 'group', g.id, {
      fields: Object.keys(data).join(','),
    });
    return { id: g.id, slug };
  }

  @Get('me/groups')
  @Authenticated()
  async myGroups(@CurrentPrincipal() p: Principal) {
    const rows = await this.prisma.groupMember.findMany({
      where: { userId: p.userId, status: { in: ['active', 'pending'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        role: true,
        status: true,
        group: { select: { id: true, slug: true, name: true, status: true, visibility: true } },
      },
    });
    return rows;
  }

  @Post('groups/:slug/join')
  @Authenticated()
  @HttpCode(200)
  async join(@Param('slug') slug: string, @CurrentPrincipal() p: Principal) {
    const g = await this.prisma.group.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, visibility: true },
    });
    if (!g) throw new NotFoundException({ code: 'NOT_FOUND' });
    const existing = await this.membership(g.id, p.userId);
    if (existing?.status === 'banned')
      throw new ForbiddenException({ code: 'BANNED', message: 'Вы заблокированы в этой группе' });
    if (existing) return { status: existing.status };
    const status = g.visibility === 'open' ? 'active' : 'pending';
    await this.prisma.groupMember.create({ data: { groupId: g.id, userId: p.userId, status } });
    if (status === 'pending') {
      const managers = await this.prisma.groupMember.findMany({
        where: { groupId: g.id, status: 'active', role: { in: MANAGERS } },
        select: { userId: true },
      });
      await this.notifications.notify(
        managers.map((m) => m.userId),
        'group_join_request',
        `/groups/${slug}`,
        p.userId,
      );
    }
    await this.log(
      `group.${status === 'active' ? 'joined' : 'join_requested'}`,
      p.userId,
      'group',
      g.id,
    );
    return { status };
  }

  @Post('groups/:slug/leave')
  @Authenticated()
  @HttpCode(200)
  async leave(@Param('slug') slug: string, @CurrentPrincipal() p: Principal) {
    const g = await this.prisma.group.findUnique({ where: { slug }, select: { id: true } });
    const m = g && (await this.membership(g.id, p.userId));
    if (!g || !m || m.status === 'banned') throw new NotFoundException({ code: 'NOT_FOUND' });
    if (m.role === 'owner')
      throw new ConflictException({
        code: 'OWNER_CANNOT_LEAVE',
        message: 'Владелец не может выйти из группы',
      });
    await this.prisma.groupMember.delete({ where: { id: m.id } });
    await this.log('group.left', p.userId, 'group', g.id);
    return { status: 'left' };
  }

  @Get('groups/:slug/members')
  @Authenticated()
  async members(@Param('slug') slug: string, @CurrentPrincipal() p: Principal) {
    const g = await this.managedGroup(slug, p.userId);
    return this.prisma.groupMember.findMany({
      where: { groupId: g.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: { userId: true, role: true, status: true, createdAt: true, user: authorSelect },
    });
  }

  @Post('groups/:slug/members/:userId/:action')
  @Authenticated()
  @HttpCode(200)
  async member(
    @Param('slug') slug: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('action') rawAction: string,
    @CurrentPrincipal() p: Principal,
  ) {
    const action = parse(memberAction, rawAction);
    const owner = ['promote', 'demote'].includes(action);
    const g = await this.managedGroup(slug, p.userId, owner ? ['owner'] : MANAGERS);
    const target = await this.membership(g.id, userId);
    if (!target) throw new NotFoundException({ code: 'NOT_FOUND' });
    const actor = await this.membership(g.id, p.userId);
    if (target.role === 'owner' || (target.role === 'moderator' && actor?.role !== 'owner'))
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Недостаточно прав в группе' });
    const next: Record<typeof action, { status?: string; role?: string } | null> = {
      approve: target.status === 'pending' ? { status: 'active' } : null,
      ban: { status: 'banned', role: 'member' },
      unban: target.status === 'banned' ? { status: 'active' } : null,
      promote: target.status === 'active' ? { role: 'moderator' } : null,
      demote: target.role === 'moderator' ? { role: 'member' } : null,
      remove: target.status !== 'banned' ? {} : null,
    };
    const data = next[action];
    if (!data) throw new ConflictException({ code: 'INVALID_TRANSITION' });
    if (action === 'remove') await this.prisma.groupMember.delete({ where: { id: target.id } });
    else await this.prisma.groupMember.update({ where: { id: target.id }, data });
    if (action === 'approve')
      await this.notifications.notify([userId], 'group_join_approved', `/groups/${slug}`, p.userId);
    await this.log(`group.member_${action}`, p.userId, 'group', g.id, { userId });
    return { userId, action };
  }

  @Get('groups/:slug/posts')
  @OptionalAuth()
  async groupPosts(
    @Param('slug') slug: string,
    @Query() query: unknown,
    @OptionalPrincipal() p?: Principal,
  ) {
    const { cursor } = parse(cursorQuery, query);
    const g = await this.prisma.group.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, visibility: true },
    });
    if (!g) throw new NotFoundException({ code: 'NOT_FOUND' });
    const m = p ? await this.membership(g.id, p.userId) : null;
    if (g.visibility === 'closed' && m?.status !== 'active')
      throw new ForbiddenException({
        code: 'MEMBERS_ONLY',
        message: 'Материалы видны только участникам',
      });
    const rows = await this.prisma.post.findMany({
      where: { groupId: g.id, status: 'published' },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: FEED_PAGE + 1,
      ...cursorArgs(cursor),
      select: postSelect,
    });
    return this.feedPage(rows as PostRow[], p?.userId);
  }

  // ---------------------------------------------------------------- feed & posts
  @Get('feed')
  @OptionalAuth()
  async feed(@Query() query: unknown, @OptionalPrincipal() p?: Principal) {
    const { scope, cursor } = parse(feedQuery, query);
    if (scope === 'groups' && !p)
      throw new HttpException({ code: 'UNAUTHENTICATED', message: 'Требуется вход' }, 401);
    const where =
      scope === 'groups'
        ? {
            status: 'published',
            group: { status: 'active', members: { some: { userId: p!.userId, status: 'active' } } },
          }
        : {
            status: 'published',
            OR: [{ groupId: null }, { group: { status: 'active', visibility: 'open' } }],
          };
    const rows = await this.prisma.post.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: FEED_PAGE + 1,
      ...cursorArgs(cursor),
      select: postSelect,
    });
    return this.feedPage(rows as PostRow[], p?.userId);
  }

  @Get('posts/:id')
  @OptionalAuth()
  async post(@Param('id', ParseUUIDPipe) id: string, @OptionalPrincipal() p?: Principal) {
    const row = (await this.prisma.post.findUnique({ where: { id }, select: postSelect })) as
      (PostRow & { groupId: string | null }) | null;
    const visible =
      row &&
      (row.authorId === p?.userId
        ? row.status !== 'deleted'
        : (await this.prisma.post.count({ where: { id, ...visiblePostWhere(p?.userId) } })) > 0);
    if (!row || !visible) throw new NotFoundException({ code: 'NOT_FOUND' });
    const [comments, liked, canModerate] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId: id, status: 'published' },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: {
          id: true,
          parentId: true,
          authorId: true,
          body: true,
          createdAt: true,
          editedAt: true,
          author: authorSelect,
        },
      }),
      p ? this.likedSet([id], p.userId) : undefined,
      p ? this.canModerate(row.groupId, p) : false,
    ]);
    return {
      ...present(row, p?.userId, liked),
      canModerate,
      canComment:
        !!p && row.status === 'published' && (await this.canParticipate(row.groupId, p.userId)),
      commentList: comments.map(({ authorId, ...c }) => ({ ...c, mine: authorId === p?.userId })),
    };
  }

  @Get('me/posts')
  @Authenticated()
  async myPosts(@CurrentPrincipal() p: Principal) {
    const rows = await this.prisma.post.findMany({
      where: { authorId: p.userId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: postSelect,
    });
    return rows.map((r) => present(r as PostRow, p.userId));
  }

  @Post('posts')
  @Authenticated()
  @HttpCode(201)
  async createPost(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const data = parse(postBody, body);
    if (data.groupId && !(await this.canParticipate(data.groupId, p.userId)))
      throw new ForbiddenException({
        code: 'MEMBERS_ONLY',
        message: 'Публиковать могут только участники группы',
      });
    await this.checkImages(p.userId, data.imageIds);
    const pending = await this.prisma.post.count({
      where: { authorId: p.userId, status: 'pending' },
    });
    if (pending >= MAX_PENDING_POSTS)
      throw new HttpException(
        { code: 'TOO_MANY_PENDING', message: 'Дождитесь проверки предыдущих публикаций' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const trusted = await isTrustedAuthor(this.prisma, p.userId);
    const post = await this.prisma.post.create({
      data: {
        ...data,
        groupId: data.groupId ?? null,
        authorId: p.userId,
        status: trusted ? 'published' : 'pending',
        publishedAt: trusted ? new Date() : null,
      },
      select: { id: true, status: true },
    });
    await this.log('post.created', p.userId, 'post', post.id, { status: post.status });
    return post;
  }

  @Patch('posts/:id')
  @Authenticated()
  async updatePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(postPatch, body);
    const post = await this.prisma.post.findFirst({
      where: { id, authorId: p.userId, status: { in: ['pending', 'published'] } },
      select: { id: true, status: true },
    });
    if (!post) throw new NotFoundException({ code: 'NOT_FOUND' });
    const trusted = await isTrustedAuthor(this.prisma, p.userId);
    const status = post.status === 'published' && !trusted ? 'pending' : post.status;
    await this.prisma.post.update({
      where: { id },
      data: {
        ...data,
        status,
        editedAt: new Date(),
        ...(status === 'pending' ? { publishedAt: null } : {}),
      },
    });
    await this.log('post.updated', p.userId, 'post', id, { status });
    return { id, status };
  }

  @Delete('posts/:id')
  @Authenticated()
  async deletePost(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const { count } = await this.prisma.post.updateMany({
      where: { id, authorId: p.userId, status: { not: 'deleted' } },
      data: { status: 'deleted', pinned: false },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.log('post.deleted', p.userId, 'post', id);
    return { id, status: 'deleted' };
  }

  @Post('posts/:id/pin')
  @Authenticated()
  @HttpCode(200)
  async pin(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const post = await this.prisma.post.findFirst({
      where: { id, status: 'published', groupId: { not: null } },
      select: { groupId: true, pinned: true },
    });
    if (!post || !(await this.isGroupManager(post.groupId!, p.userId)))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.prisma.post.update({ where: { id }, data: { pinned: !post.pinned } });
    await this.log(post.pinned ? 'post.unpinned' : 'post.pinned', p.userId, 'post', id);
    return { id, pinned: !post.pinned };
  }

  /** Group managers remove posts in their group; platform moderators anywhere. Reason is shown to the author. */
  @Post('posts/:id/remove')
  @Authenticated()
  @HttpCode(200)
  async removePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { note } = parse(noteBody, body);
    const post = await this.prisma.post.findFirst({
      where: { id, status: 'published' },
      select: { groupId: true, authorId: true },
    });
    if (!post || !(await this.canModerate(post.groupId, p)))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.prisma.post.update({
      where: { id },
      data: { status: 'removed', moderationNote: note, pinned: false },
    });
    await this.log('post.removed', p.userId, 'post', id);
    await this.notifications.notify([post.authorId], 'post_removed', '/groups/mine', p.userId);
    return { id, status: 'removed' };
  }

  // ---------------------------------------------------------------- reactions
  @Put('posts/:id/reaction')
  @Authenticated()
  async react(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    await this.visiblePost(id, p.userId);
    await this.prisma.postReaction.upsert({
      where: { postId_userId: { postId: id, userId: p.userId } },
      create: { postId: id, userId: p.userId },
      update: {},
    });
    return this.reactionState(id, true);
  }

  @Delete('posts/:id/reaction')
  @Authenticated()
  async unreact(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    await this.prisma.postReaction.deleteMany({ where: { postId: id, userId: p.userId } });
    return this.reactionState(id, false);
  }

  // ---------------------------------------------------------------- comments
  @Post('posts/:id/comments')
  @Authenticated()
  @HttpCode(201)
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const data = parse(commentBody, body);
    const post = await this.visiblePost(id, p.userId);
    if (!(await this.canParticipate(post.groupId, p.userId)))
      throw new ForbiddenException({
        code: 'MEMBERS_ONLY',
        message: 'Комментировать могут только участники группы',
      });
    let parentAuthor: string | undefined;
    if (data.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: data.parentId, postId: id, parentId: null, status: 'published' },
        select: { authorId: true },
      });
      if (!parent) throw new BadRequestException({ code: 'INVALID_PARENT' });
      parentAuthor = parent.authorId;
    }
    const recent = await this.prisma.comment.count({
      where: {
        authorId: p.userId,
        createdAt: { gt: new Date(Date.now() - COMMENT_LIMIT.windowMs) },
      },
    });
    if (recent >= COMMENT_LIMIT.count)
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Слишком много комментариев, попробуйте через несколько минут',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const c = await this.prisma.comment.create({
      data: { postId: id, authorId: p.userId, body: data.body, parentId: data.parentId ?? null },
      select: { id: true },
    });
    await this.log('comment.created', p.userId, 'comment', c.id, { postId: id });
    const href = `/feed/${id}`;
    if (parentAuthor)
      await this.notifications.notify([parentAuthor], 'comment_reply', href, p.userId);
    if (post.authorId !== parentAuthor)
      await this.notifications.notify([post.authorId], 'post_comment', href, p.userId);
    return c;
  }

  @Patch('comments/:id')
  @Authenticated()
  async editComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { body: text } = parse(commentBody.pick({ body: true }), body);
    const { count } = await this.prisma.comment.updateMany({
      where: { id, authorId: p.userId, status: 'published' },
      data: { body: text, editedAt: new Date() },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.log('comment.updated', p.userId, 'comment', id);
    return { id };
  }

  @Delete('comments/:id')
  @Authenticated()
  async deleteComment(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: Principal) {
    const { count } = await this.prisma.comment.updateMany({
      where: { id, authorId: p.userId, status: 'published' },
      data: { status: 'deleted' },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.log('comment.deleted', p.userId, 'comment', id);
    return { id, status: 'deleted' };
  }

  @Post('comments/:id/remove')
  @Authenticated()
  @HttpCode(200)
  async removeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { note } = parse(noteBody, body);
    const c = await this.prisma.comment.findFirst({
      where: { id, status: 'published' },
      select: { authorId: true, postId: true, post: { select: { groupId: true } } },
    });
    if (!c || !(await this.canModerate(c.post.groupId, p)))
      throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.prisma.comment.update({
      where: { id },
      data: { status: 'removed', moderationNote: note },
    });
    await this.log('comment.removed', p.userId, 'comment', id);
    await this.notifications.notify([c.authorId], 'comment_removed', `/feed/${c.postId}`, p.userId);
    return { id, status: 'removed' };
  }

  // ---------------------------------------------------------------- platform moderation
  @Get('moderation/posts')
  @RequirePermission('moderation.community')
  async postQueue(@Query() query: unknown) {
    const { status } = parse(statusQuery, query);
    const rows = await this.prisma.post.findMany({
      where: { status },
      orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' },
      take: 100,
      select: postSelect,
    });
    return rows.map(({ _count, authorId: _a, ...r }) => ({ ...r, reactions: _count.reactions }));
  }

  @Post('moderation/posts/:id/:decision')
  @RequirePermission('moderation.community')
  @HttpCode(200)
  async decidePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('decision') decision: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const d = parse(z.enum(['approve', 'reject']), decision);
    const note = d === 'reject' ? parse(noteBody, body).note : null;
    const { count } = await this.prisma.post.updateMany({
      where: { id, status: 'pending' },
      data:
        d === 'approve'
          ? { status: 'published', publishedAt: new Date(), moderationNote: null }
          : { status: 'rejected', moderationNote: note },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.log(`post.${d === 'approve' ? 'approved' : 'rejected'}`, p.userId, 'post', id);
    const author = await this.prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (author)
      await this.notifications.notify(
        [author.authorId],
        d === 'approve' ? 'post_approved' : 'post_rejected',
        d === 'approve' ? `/feed/${id}` : '/groups/mine',
        p.userId,
      );
    return { id, status: d === 'approve' ? 'published' : 'rejected' };
  }

  @Get('moderation/groups')
  @RequirePermission('moderation.community')
  async groupQueue(@Query() query: unknown) {
    const { status } = parse(statusQuery, query);
    return this.prisma.group.findMany({
      where: { status },
      orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' },
      take: 100,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        rules: true,
        topic: true,
        visibility: true,
        status: true,
        moderationNote: true,
        createdAt: true,
      },
    });
  }

  @Post('moderation/groups/:id/:decision')
  @RequirePermission('moderation.community')
  @HttpCode(200)
  async decideGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('decision') decision: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const d = parse(z.enum(['approve', 'reject', 'archive']), decision);
    const note = d === 'approve' ? null : parse(noteBody, body).note;
    const status = { approve: 'active', reject: 'rejected', archive: 'archived' }[d];
    const { count } = await this.prisma.group.updateMany({
      where: { id, status: d === 'archive' ? 'active' : 'pending' },
      data: { status, moderationNote: note },
    });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.log(`group.${status}`, p.userId, 'group', id);
    const g = await this.prisma.group.findUnique({
      where: { id },
      select: { slug: true, createdById: true },
    });
    if (g)
      await this.notifications.notify(
        [g.createdById],
        d === 'approve' ? 'group_approved' : d === 'reject' ? 'group_rejected' : 'group_archived',
        d === 'reject' ? '/groups/mine' : `/groups/${g.slug}`,
        p.userId,
      );
    return { id, status };
  }

  // ---------------------------------------------------------------- helpers
  private membership(groupId: string, userId: string) {
    return this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true, role: true, status: true },
    });
  }

  private async isGroupManager(groupId: string, userId: string) {
    const m = await this.membership(groupId, userId);
    return m?.status === 'active' && MANAGERS.includes(m.role);
  }

  private async canModerate(groupId: string | null, p: Principal) {
    if (p.permissions.has('moderation.community')) return true;
    return groupId ? this.isGroupManager(groupId, p.userId) : false;
  }

  /** General feed: any signed-in resident; group: active member of an active group. */
  private async canParticipate(groupId: string | null | undefined, userId: string) {
    if (!groupId) return true;
    const m = await this.prisma.groupMember.count({
      where: { groupId, userId, status: 'active', group: { status: 'active' } },
    });
    return m > 0;
  }

  private async managedGroup(slug: string, userId: string, roles = MANAGERS) {
    const g = await this.prisma.group.findFirst({
      where: { slug, members: { some: { userId, status: 'active', role: { in: roles } } } },
      select: { id: true },
    });
    if (!g) throw new NotFoundException({ code: 'NOT_FOUND' });
    return g;
  }

  private async visiblePost(id: string, userId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, ...visiblePostWhere(userId) },
      select: { id: true, groupId: true, authorId: true },
    });
    if (!post) throw new NotFoundException({ code: 'NOT_FOUND' });
    return post;
  }

  private async likedSet(ids: string[], userId: string) {
    const rows = await this.prisma.postReaction.findMany({
      where: { userId, postId: { in: ids } },
      select: { postId: true },
    });
    return new Set(rows.map((r) => r.postId));
  }

  private async feedPage(rows: PostRow[], viewer?: string) {
    const { items, nextCursor } = page(rows);
    const liked = viewer
      ? await this.likedSet(
          items.map((i) => i.id),
          viewer,
        )
      : undefined;
    return { items: items.map((r) => present(r, viewer, liked)), nextCursor };
  }

  private async reactionState(postId: string, liked: boolean) {
    return { liked, reactions: await this.prisma.postReaction.count({ where: { postId } }) };
  }

  private async checkImages(userId: string, ids: string[]) {
    if (!ids.length) return;
    const owned = await this.prisma.mediaAsset.count({
      where: { id: { in: ids }, ownerId: userId, private: false },
    });
    if (owned !== new Set(ids).size)
      throw new BadRequestException({
        code: 'INVALID_MEDIA',
        message: 'Можно прикреплять только свои изображения',
      });
  }

  private log(
    action: string,
    actorId: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, string> = {},
  ) {
    return this.audit.record({
      action,
      outcome: 'success',
      actorId,
      entityType,
      entityId,
      metadata,
    });
  }
}
