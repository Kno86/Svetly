import 'reflect-metadata';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig } from './config/env.js';
import { hashPassword } from './auth/password.js';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { clearDemo, seedDemo } from './demo.js';

const USAGE =
  'Usage: node dist/cli.js admin:create --email <email> [--name <name>] | demo:seed | demo:clear';

/** Reads a line from the TTY without echoing it, so the password never reaches argv, env, history or logs. */
async function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(
      'An interactive terminal is required (use `docker compose exec api ...`, not `-T`).',
    );
  }
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    return await new Promise<string>((resolve) => {
      rl.question(question, (answer) => resolve(answer));
      muted = true;
    });
  } finally {
    muted = false;
    rl.close();
    process.stdout.write('\n');
  }
}

async function adminCreate(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { email: { type: 'string' }, name: { type: 'string' } },
  });
  const email = z.email().safeParse(values.email?.trim().toLowerCase());
  if (!email.success) throw new Error(`A valid --email is required.\n${USAGE}`);
  const name = values.name?.trim() || 'Администратор';

  const config = loadConfig();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
  try {
    const existing = await prisma.userRole.findFirst({
      where: { roleCode: 'super_admin' },
      select: { user: { select: { email: true } } },
    });
    if (existing) {
      console.log(`Super Admin already exists (${existing.user.email}). Nothing changed.`);
      return;
    }
    if (await prisma.user.findUnique({ where: { email: email.data } })) {
      throw new Error('A user with this email already exists. Choose another email.');
    }

    const password = await promptHidden('Пароль (не отображается): ');
    if (password.length < 12 || password.length > 128)
      throw new Error('Password must be 12–128 characters.');
    if ((await promptHidden('Повторите пароль: ')) !== password)
      throw new Error('Passwords do not match.');
    const hash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: email.data, name, emailVerified: true },
      });
      await tx.account.create({
        data: {
          userId: created.id,
          accountId: created.id,
          providerId: 'credential',
          password: hash,
        },
      });
      await tx.userRole.create({ data: { userId: created.id, roleCode: 'super_admin' } });
      await tx.auditLog.create({
        data: {
          action: 'rbac.role_granted',
          outcome: 'success',
          entityType: 'user',
          entityId: created.id,
          metadata: { role: 'super_admin', via: 'cli' },
        },
      });
      return created;
    });
    console.log(`Super Admin created: ${user.email} (${user.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

async function demo(command: 'demo:seed' | 'demo:clear'): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: loadConfig().databaseUrl }),
  });
  try {
    if (command === 'demo:seed')
      console.log(`Demo content added: ${(await seedDemo(prisma)).join(', ')}.`);
    else console.log(`Demo content removed: ${await clearDemo(prisma)} records.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'admin:create') return adminCreate(rest);
  if (command === 'demo:seed' || command === 'demo:clear') return demo(command);
  throw new Error(USAGE);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
