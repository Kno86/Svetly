import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';
import { AuditService, type AuditOutcome } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailNotConfiguredError, MailerService } from './mailer.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { resolveAuthSecret } from './secret.js';

/** Auth endpoints whose outcome is written to the audit log. */
const AUDITED_PATHS: Record<string, string> = {
  '/sign-up/email': 'auth.sign_up',
  '/sign-in/email': 'auth.sign_in',
  '/sign-out': 'auth.sign_out',
  '/verify-email': 'auth.email_verified',
  '/request-password-reset': 'auth.password_reset_requested',
  '/reset-password': 'auth.password_reset',
  '/change-password': 'auth.password_changed',
  '/revoke-session': 'auth.session_revoked',
  '/revoke-other-sessions': 'auth.other_sessions_revoked',
  '/revoke-sessions': 'auth.all_sessions_revoked',
};

export function clientIp(headers: Headers | undefined): string | null {
  return headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

/** Pseudonymous identifier so repeated failures can be correlated without storing the address. */
export function emailFingerprint(email: unknown): string | undefined {
  if (typeof email !== 'string') return undefined;
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
}

function mailError(error: unknown): never {
  if (error instanceof EmailNotConfiguredError) {
    throw new APIError('SERVICE_UNAVAILABLE', {
      code: 'EMAIL_NOT_CONFIGURED',
      message: 'Отправка писем не настроена. Обратитесь к администратору.',
    });
  }
  throw error;
}

function createAuth(
  config: AppConfig,
  prisma: PrismaService,
  mailer: MailerService,
  audit: AuditService,
) {
  return betterAuth({
    appName: 'SVETLY',
    baseURL: config.publicUrl,
    basePath: '/api/auth',
    secret: resolveAuthSecret(config),
    trustedOrigins: [config.publicUrl],
    telemetry: { enabled: false },
    database: prismaAdapter(prisma, { provider: 'postgresql', transaction: true }),
    advanced: {
      database: { generateId: false },
      cookiePrefix: 'svetly',
      useSecureCookies: config.environment === 'production',
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) => {
        await mailer
          .send({
            to: user.email,
            subject: 'SVETLY: восстановление пароля',
            text: `Здравствуйте, ${user.name}!\n\nЧтобы задать новый пароль, перейдите по ссылке (действует 1 час):\n${url}\n\nЕсли вы не запрашивали восстановление, просто проигнорируйте это письмо.`,
          })
          .catch(mailError);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer
          .send({
            to: user.email,
            subject: 'SVETLY: подтверждение email',
            text: `Здравствуйте, ${user.name}!\n\nПодтвердите адрес электронной почты (ссылка действует 24 часа):\n${url}\n\nЕсли вы не регистрировались в SVETLY, проигнорируйте это письмо.`,
          })
          .catch(mailError);
      },
    },
    user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    session: { expiresIn: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 10 },
        '/request-password-reset': { window: 60 * 60, max: 5 },
        '/send-verification-email': { window: 60 * 60, max: 5 },
        '/change-password': { window: 60, max: 5 },
        '/reset-password': { window: 60 * 60, max: 10 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { blockedAt: true },
            });
            if (user?.blockedAt) {
              throw new APIError('FORBIDDEN', {
                code: 'USER_BLOCKED',
                message: 'Учётная запись заблокирована.',
              });
            }
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const action = AUDITED_PATHS[ctx.path];
        if (!action) return;
        const returned = ctx.context.returned;
        const failed = returned instanceof APIError;
        const outcome: AuditOutcome = failed ? 'failure' : 'success';
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const actorId = ctx.context.newSession?.user.id ?? ctx.context.session?.user.id ?? null;
        await audit.record({
          action,
          outcome,
          actorId,
          entityType: 'user',
          entityId: actorId ?? undefined,
          ipAddress: clientIp(ctx.request?.headers ?? ctx.headers),
          requestId: ctx.headers?.get('x-request-id') ?? null,
          metadata: {
            ...(failed ? { status: returned.status, code: String(returned.body?.code ?? '') } : {}),
            ...(emailFingerprint(body.email)
              ? { emailFingerprint: emailFingerprint(body.email)! }
              : {}),
          },
        });
      }),
    },
  });
}

export type SvetlyAuth = ReturnType<typeof createAuth>;

@Injectable()
export class AuthService {
  readonly logger = new Logger(AuthService.name);
  readonly auth: SvetlyAuth;

  constructor(
    @Inject(APP_CONFIG) readonly config: AppConfig,
    prisma: PrismaService,
    readonly mailer: MailerService,
    audit: AuditService,
  ) {
    this.auth = createAuth(config, prisma, mailer, audit);
    if (!mailer.configured) {
      this.logger.warn(
        'SMTP_URL is not set: registration and password reset emails cannot be sent',
      );
    }
  }
}
