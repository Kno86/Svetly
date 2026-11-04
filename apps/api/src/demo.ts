import type { PrismaClient } from './generated/prisma/client.js';

/**
 * One clearly fictional record per public section, so an empty instance can be shown.
 * Every record is labelled «Демо», has a `demo-` slug, no phones, addresses or real names,
 * and is owned by a system user that cannot sign in (no credential account).
 */
export const DEMO_EMAIL = 'demo@svetly.invalid';
const PREFIX = 'demo-';
const NOTE =
  'Это демонстрационная запись: она показывает, как выглядит раздел. Все данные вымышлены и будут удалены после наполнения платформы.';
const DAY = 86_400_000;

type Db = PrismaClient;

async function categoryId(db: Db, module: string, slug: string): Promise<string> {
  const c = await db.category.findFirst({ where: { module, slug }, select: { id: true } });
  if (!c) throw new Error(`Category ${module}/${slug} not found. Run migrations first.`);
  return c.id;
}

export async function seedDemo(db: Db, now = new Date()): Promise<string[]> {
  if (await db.user.findUnique({ where: { email: DEMO_EMAIL } }))
    throw new Error('Demo content already exists. Run demo:clear first.');
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  const done: string[] = [];
  await db.$transaction(async (tx) => {
    const t = tx as unknown as Db;
    const user = await tx.user.create({
      data: { email: DEMO_EMAIL, name: 'Демо-житель', emailVerified: true },
    });
    const author = user.id;

    await tx.newsArticle.create({
      data: {
        slug: `${PREFIX}news`,
        title: 'Демо: так выглядит новость посёлка',
        excerpt: 'Пример новости. Настоящие новости публикует редакция платформы.',
        body: `${NOTE}\n\nЗдесь будет текст новости: что произошло, когда и что это значит для жителей.`,
        categoryId: await categoryId(t, 'news', 'obshchestvo'),
        status: 'published',
        publishedAt: now,
        isDemo: true,
      },
    });
    done.push('Новости');

    await tx.announcement.create({
      data: {
        slug: `${PREFIX}announcement`,
        title: 'Демо: отдам детский велосипед',
        description: `${NOTE}\n\nПример частного объявления: описание вещи, состояние и как договориться.`,
        categoryId: await categoryId(t, 'announcements', 'otdam-darom'),
        price: 0,
        condition: 'used',
        status: 'published',
        publishedAt: now,
        expiresAt: at(30),
        isDemo: true,
        authorId: author,
      },
    });
    done.push('Объявления');

    await tx.job.create({
      data: {
        slug: `${PREFIX}job`,
        title: 'Демо: помощник в магазин',
        employer: 'Демо-работодатель (вымышленный)',
        description: `${NOTE}\n\nПример вакансии: обязанности, график и условия.`,
        status: 'published',
        publishedAt: now,
        expiresAt: at(30),
        authorId: author,
      },
    });
    done.push('Вакансии');

    await tx.lostFoundItem.create({
      data: {
        slug: `${PREFIX}lost-found`,
        kind: 'found',
        subject: 'item',
        title: 'Демо: найдены ключи',
        description: `${NOTE}\n\nПример находки: что нашли, где и как вернуть владельцу.`,
        status: 'published',
        publishedAt: now,
        expiresAt: at(30),
        authorId: author,
      },
    });
    done.push('Потеряно и найдено');

    await tx.organization.create({
      data: {
        slug: `${PREFIX}organization`,
        kind: 'organization',
        name: 'Демо: пример организации',
        description: `${NOTE}\n\nЗдесь организация рассказывает о себе. Контакты появятся у настоящих карточек.`,
        categoryId: await categoryId(t, 'organizations', 'drugoe'),
        status: 'published',
        isDemo: true,
      },
    });
    await tx.organization.create({
      data: {
        slug: `${PREFIX}service`,
        kind: 'service',
        name: 'Демо: пример частной услуги',
        description: `${NOTE}\n\nЗдесь мастер описывает, какие работы выполняет.`,
        services: 'Пример услуги',
        categoryId: await categoryId(t, 'services', 'drugoe'),
        status: 'published',
        isDemo: true,
      },
    });
    done.push('Организации', 'Услуги');

    await tx.directoryEntry.create({
      data: {
        slug: `${PREFIX}directory`,
        title: 'Демо: пример записи справочника',
        kind: 'contact',
        body: `${NOTE} Телефон не указан намеренно: в справочник попадают только проверенные номера.`,
        categoryId: await categoryId(t, 'directory', 'instrukcii'),
        status: 'published',
        isDemo: true,
      },
    });
    done.push('Справочник');

    await tx.event.create({
      data: {
        slug: `${PREFIX}event`,
        title: 'Демо: соседский субботник',
        description: `${NOTE}\n\nПример события: что будет, во сколько и что взять с собой.`,
        organizer: 'Демо-организатор (вымышленный)',
        location: 'Демо-площадка (вымышленное место)',
        startsAt: at(7),
        endsAt: new Date(at(7).getTime() + 2 * 3_600_000),
        categoryId: await categoryId(t, 'events', 'vstrechi'),
        status: 'published',
        isDemo: true,
      },
    });
    done.push('События');

    await tx.poll.create({
      data: {
        slug: `${PREFIX}poll`,
        title: 'Демо: какой раздел вам нужнее?',
        description: NOTE,
        opensAt: at(-1),
        closesAt: at(14),
        status: 'published',
        options: {
          create: [
            { label: 'Новости', position: 0 },
            { label: 'Объявления', position: 1 },
            { label: 'События', position: 2 },
          ],
        },
      },
    });
    done.push('Опросы');

    await tx.issue.create({
      data: {
        reporterId: author,
        category: 'lighting',
        title: 'Демо: не горит фонарь во дворе',
        description: `${NOTE}\n\nПример обращения: что случилось и где. Адрес у демо-записи не указан.`,
        isPublic: true,
      },
    });
    done.push('Обращения');

    const group = await tx.group.create({
      data: {
        slug: `${PREFIX}group`,
        name: 'Демо: соседи',
        description: NOTE,
        topic: 'neighbors',
        status: 'active',
        createdById: author,
        members: { create: { userId: author, role: 'owner', status: 'active' } },
      },
    });
    done.push('Группы');

    await tx.post.create({
      data: {
        authorId: author,
        groupId: group.id,
        body: `Демо: так выглядит пост в ленте. ${NOTE}`,
        status: 'published',
        publishedAt: now,
      },
    });
    done.push('Лента');
  });
  return done;
}

export async function clearDemo(db: Db): Promise<number> {
  const user = await db.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  const slug = { startsWith: PREFIX };
  return db.$transaction(async (tx) => {
    let n = 0;
    const add = (r: { count: number }) => (n += r.count);
    if (user) {
      add(await tx.post.deleteMany({ where: { authorId: user.id } }));
      add(await tx.issue.deleteMany({ where: { reporterId: user.id } }));
    }
    add(await tx.group.deleteMany({ where: { slug, ...(user ? { createdById: user.id } : {}) } }));
    const polls = await tx.poll.findMany({
      where: { slug, createdById: null },
      select: { id: true },
    });
    await tx.pollOption.deleteMany({ where: { pollId: { in: polls.map((p) => p.id) } } });
    add(await tx.poll.deleteMany({ where: { id: { in: polls.map((p) => p.id) } } }));
    if (user) {
      add(await tx.job.deleteMany({ where: { slug, authorId: user.id } }));
      add(await tx.lostFoundItem.deleteMany({ where: { slug, authorId: user.id } }));
    }
    add(await tx.announcement.deleteMany({ where: { slug, isDemo: true } }));
    add(await tx.newsArticle.deleteMany({ where: { slug, isDemo: true } }));
    add(await tx.organization.deleteMany({ where: { slug, isDemo: true } }));
    add(await tx.directoryEntry.deleteMany({ where: { slug, isDemo: true } }));
    add(await tx.event.deleteMany({ where: { slug, isDemo: true } }));
    if (user) await tx.user.delete({ where: { id: user.id } });
    return n;
  });
}
