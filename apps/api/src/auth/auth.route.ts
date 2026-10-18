import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SvetlyAuth } from './auth.service.js';

const SKIPPED_REQUEST_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection']);
const SKIPPED_RESPONSE_HEADERS = new Set([
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'set-cookie',
]);

/** Bridges Fastify to Better Auth's Fetch API handler for every `/api/auth/*` route. */
export function registerAuthRoutes(
  fastify: FastifyInstance,
  auth: SvetlyAuth,
  publicUrl: string,
): void {
  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      // Login CSRF: Better Auth only checks the origin when a cookie is present, so enforce it for every POST.
      if (req.method === 'POST' && requestOrigin(req) !== publicUrl) {
        return reply
          .status(403)
          .send({ code: 'CSRF_ORIGIN_MISMATCH', message: 'Недопустимый источник запроса' });
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined || SKIPPED_REQUEST_HEADERS.has(key)) continue;
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      headers.set('x-request-id', String(req.id));
      const hasBody = req.method !== 'GET' && req.body !== undefined && req.body !== null;
      const response = await auth.handler(
        new Request(new URL(req.url, publicUrl), {
          method: req.method,
          headers,
          body: hasBody ? JSON.stringify(req.body) : undefined,
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (!SKIPPED_RESPONSE_HEADERS.has(key)) reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
}

function requestOrigin(req: FastifyRequest): string | undefined {
  if (req.headers.origin) return req.headers.origin;
  try {
    return req.headers.referer ? new URL(req.headers.referer).origin : undefined;
  } catch {
    return undefined;
  }
}
