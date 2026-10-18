export type SvetlyEnvironment = 'local' | 'production';

export interface AppConfig {
  environment: SvetlyEnvironment;
  databaseUrl: string;
  port: number;
  logLevel: string;
  /** Public origin of the web app; used for links in emails, cookies and CSRF origin checks. */
  publicUrl: string;
  /** Explicit secret (required in production). Locally a generated secret is persisted to `authSecretFile`. */
  authSecret: string | undefined;
  authSecretFile: string;
  /** SMTP connection URL. Without it, email sending reports "not configured" instead of pretending. */
  smtpUrl: string | undefined;
  mailFrom: string;
}

const DEV_ONLY_MARKER = 'local_dev_only';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = (env.SVETLY_ENV ?? 'local') as SvetlyEnvironment;
  if (environment !== 'local' && environment !== 'production') {
    throw new Error(`SVETLY_ENV must be "local" or "production", got "${environment}"`);
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (environment === 'production' && databaseUrl.includes(DEV_ONLY_MARKER)) {
    throw new Error('Refusing to start in production with local development database credentials');
  }

  const port = Number(env.API_PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`API_PORT must be a valid TCP port, got "${env.API_PORT}"`);
  }

  const publicUrl = (env.SVETLY_PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  let parsedPublicUrl: URL;
  try {
    parsedPublicUrl = new URL(publicUrl);
  } catch {
    throw new Error(`SVETLY_PUBLIC_URL must be an absolute URL, got "${publicUrl}"`);
  }
  if (environment === 'production' && parsedPublicUrl.protocol !== 'https:') {
    throw new Error('SVETLY_PUBLIC_URL must use https in production');
  }

  const authSecret = env.BETTER_AUTH_SECRET || undefined;
  if (environment === 'production') {
    if (!authSecret || authSecret.length < 32 || authSecret.includes(DEV_ONLY_MARKER)) {
      throw new Error(
        'BETTER_AUTH_SECRET (at least 32 random characters) is required in production',
      );
    }
  }

  return {
    environment,
    databaseUrl,
    port,
    logLevel: env.LOG_LEVEL ?? 'info',
    publicUrl: parsedPublicUrl.origin,
    authSecret,
    authSecretFile: env.AUTH_SECRET_FILE ?? '/var/lib/svetly/auth-secret',
    smtpUrl: env.SMTP_URL || undefined,
    mailFrom: env.MAIL_FROM ?? 'SVETLY <no-reply@svetly.local>',
  };
}
