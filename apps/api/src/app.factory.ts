import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { registerAuthRoutes } from './auth/auth.route.js';
import { AuthService } from './auth/auth.service.js';

export async function createApp(logLevel = 'info'): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger: {
      level: logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    genReqId: (req: IncomingMessage) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && /^[\w-]{1,64}$/.test(header) ? header : randomUUID();
    },
    trustProxy: true,
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: false,
    logger: new ConsoleLogger({ json: !process.stdout.isTTY, colors: process.stdout.isTTY }),
  });
  app.setGlobalPrefix('api');
  const { auth, config } = app.get(AuthService);
  registerAuthRoutes(app.getHttpAdapter().getInstance(), auth, config.publicUrl);
  app.enableShutdownHooks();
  return app;
}
