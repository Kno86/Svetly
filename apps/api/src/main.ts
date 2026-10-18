import 'reflect-metadata';
import { createApp } from './app.factory.js';
import { loadConfig } from './config/env.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config.logLevel);
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start SVETLY API', error);
  process.exit(1);
});
