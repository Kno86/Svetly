import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { Authenticated, CurrentPrincipal, RequirePermission } from '../auth/guards.js';
import type { Principal } from '../auth/principal.js';
import { parse } from '../common/validation.js';
import { assertPublicImages, imageIdsField } from './media-refs.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { uniqueSlug } from './slug.js';

const pollBody = z
  .object({
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().max(3000).default(''),
    mode: z.enum(['anonymous', 'identified']).default('anonymous'),
    allowRevote: z.boolean().default(false),
    opensAt: z.iso.datetime({ offset: true }),
    closesAt: z.iso.datetime({ offset: true }),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(10),
    imageIds: imageIdsField(),
  })
  .refine((v) => new Date(v.closesAt) > new Date(v.opensAt), 'Дата закрытия раньше открытия');
const pollPatch = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().max(3000).optional(),
  closesAt: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(10).optional(),
  mode: z.enum(['anonymous', 'identified']).optional(),
  allowRevote: z.boolean().optional(),
  opensAt: z.iso.datetime({ offset: true }).optional(),
  imageIds: z.array(z.uuid()).max(10).optional(),
});
const voteBody = z.object({ optionId: z.uuid() });

const publicSelect = {
  imageIds: true,
  id: true,
  slug: true,
  title: true,
  description: true,
  mode: true,
  allowRevote: true,
  opensAt: true,
  closesAt: true,
  options: { orderBy: { position: 'asc' }, select: { id: true, label: true } },
} as const;

export function pollPhase(p: { opensAt: Date; closesAt: Date }, now = new Date()) {
  return now < p.opensAt ? 'upcoming' : now >= p.closesAt ? 'closed' : 'open';
}

/** Community polls. Results are public only after closing (or to a resident who has already voted). */
@Controller()
export class PollsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async results(pollId: string) {
    const options = await this.prisma.pollOption.findMany({
      where: { pollId },
      orderBy: { position: 'asc' },
      select: { id: true, label: true, _count: { select: { votes: true } } },
    });
    const rows = options.map((o) => ({ optionId: o.id, label: o.label, votes: o._count.votes }));
    return { total: rows.reduce((s, r) => s + r.votes, 0), options: rows };
  }

  private async findPublished(slug: string) {
    const poll = await this.prisma.poll.findFirst({
      where: { slug, status: 'published' },
      select: publicSelect,
    });
    if (!poll) throw new NotFoundException({ code: 'NOT_FOUND' });
    return poll;
  }

  @Get('polls')
  async list() {
    const polls = await this.prisma.poll.findMany({
      where: { status: 'published' },
      orderBy: { opensAt: 'desc' },
      take: 50,
      select: {
        slug: true,
        title: true,
        opensAt: true,
        closesAt: true,
        mode: true,
        _count: { select: { votes: true } },
      },
    });
    return polls.map(({ _count, ...p }) => ({
      ...p,
      phase: pollPhase(p),
      votes: pollPhase(p) === 'closed' ? _count.votes : null,
    }));
  }

  @Get('polls/:slug')
  async detail(@Param('slug') slug: string) {
    const poll = await this.findPublished(slug);
    const phase = pollPhase(poll);
    return { ...poll, phase, results: phase === 'closed' ? await this.results(poll.id) : null };
  }

  @Get('polls/:slug/me')
  @Authenticated()
  async myVote(@Param('slug') slug: string, @CurrentPrincipal() p: Principal) {
    const poll = await this.findPublished(slug);
    const vote = await this.prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: p.userId } },
    });
    return { optionId: vote?.optionId ?? null, results: vote ? await this.results(poll.id) : null };
  }

  @Post('polls/:slug/vote')
  @HttpCode(200)
  @Authenticated()
  async vote(@Param('slug') slug: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { optionId } = parse(voteBody, body);
    const poll = await this.findPublished(slug);
    if (pollPhase(poll) !== 'open')
      throw new BadRequestException({
        code: 'POLL_NOT_OPEN',
        message: 'Опрос сейчас не принимает ответы',
      });
    if (!poll.options.some((o) => o.id === optionId))
      throw new BadRequestException({ code: 'INVALID_OPTION' });
    const key = { pollId_userId: { pollId: poll.id, userId: p.userId } };
    const existing = await this.prisma.pollVote.findUnique({ where: key });
    if (existing && !poll.allowRevote)
      throw new ConflictException({
        code: 'ALREADY_VOTED',
        message: 'Вы уже ответили на этот опрос',
      });
    try {
      if (existing) await this.prisma.pollVote.update({ where: key, data: { optionId } });
      else
        await this.prisma.pollVote.create({
          data: { pollId: poll.id, optionId, userId: p.userId },
        });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException({
          code: 'ALREADY_VOTED',
          message: 'Вы уже ответили на этот опрос',
        });
      throw e;
    }
    await this.audit.record({
      action: existing ? 'poll.revoted' : 'poll.voted',
      outcome: 'success',
      actorId: p.userId,
      entityType: 'poll',
      entityId: poll.id,
    });
    return { optionId, results: await this.results(poll.id) };
  }

  @Get('staff/polls')
  @RequirePermission('polls.manage')
  async staffList() {
    return this.prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { options: { orderBy: { position: 'asc' } }, _count: { select: { votes: true } } },
    });
  }

  @Post('staff/polls')
  @RequirePermission('polls.manage')
  async create(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const { options, opensAt, closesAt, ...data } = parse(pollBody, body);
    await assertPublicImages(this.prisma, data.imageIds);
    const poll = await this.prisma.poll.create({
      data: {
        ...data,
        opensAt: new Date(opensAt),
        closesAt: new Date(closesAt),
        slug: uniqueSlug(data.title),
        createdById: p.userId,
        options: { create: options.map((label, position) => ({ label, position })) },
      },
      include: { options: true },
    });
    await this.log('created', p.userId, poll.id);
    return poll;
  }

  /** Once anyone has voted, options, mode, revote rule and opening date are frozen. */
  @Patch('staff/polls/:id')
  @RequirePermission('polls.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() p: Principal,
  ) {
    const { options, opensAt, closesAt, ...data } = parse(pollPatch, body);
    await assertPublicImages(this.prisma, data.imageIds);
    const poll = await this.prisma.poll.findUnique({
      where: { id },
      include: { _count: { select: { votes: true } } },
    });
    if (!poll) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (
      poll._count.votes > 0 &&
      (options || data.mode || data.allowRevote !== undefined || opensAt)
    )
      throw new ConflictException({
        code: 'POLL_HAS_VOTES',
        message: 'После первых ответов можно менять только текст, срок и статус',
      });
    const open = opensAt ? new Date(opensAt) : poll.opensAt;
    const close = closesAt ? new Date(closesAt) : poll.closesAt;
    if (close <= open)
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Дата закрытия раньше открытия',
      });
    const updated = await this.prisma.$transaction(async (tx) => {
      if (options) {
        await tx.pollOption.deleteMany({ where: { pollId: id } });
        await tx.pollOption.createMany({
          data: options.map((label, position) => ({ pollId: id, label, position })),
        });
      }
      return tx.poll.update({
        where: { id },
        data: { ...data, opensAt: open, closesAt: close },
        include: { options: true },
      });
    });
    await this.log('updated', p.userId, id);
    return updated;
  }

  /** Voter names are available to staff only for polls explicitly run in identified mode. */
  @Get('staff/polls/:id/results')
  @RequirePermission('polls.manage')
  async staffResults(@Param('id', ParseUUIDPipe) id: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id } });
    if (!poll) throw new NotFoundException({ code: 'NOT_FOUND' });
    const results = await this.results(id);
    if (poll.mode !== 'identified') return { ...results, voters: null };
    const votes = await this.prisma.pollVote.findMany({
      where: { pollId: id },
      select: { optionId: true, userId: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: votes.map((v) => v.userId) } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return {
      ...results,
      voters: votes.map((v) => ({ optionId: v.optionId, name: names.get(v.userId) ?? '' })),
    };
  }

  private log(action: string, actorId: string, id: string) {
    return this.audit.record({
      action: `poll.${action}`,
      outcome: 'success',
      actorId,
      entityType: 'poll',
      entityId: id,
    });
  }
}
