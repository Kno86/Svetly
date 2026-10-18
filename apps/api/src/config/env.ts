export type SvetlyEnvironment = 'local' | 'production';

export interface AppConfig {
  environment: SvetlyEnvironment;
  databaseUrl: string;
  port: number;
  logLevel: string;
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

  return {
    environment,
    databaseUrl,
    port,
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
