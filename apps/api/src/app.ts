import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { env } from './config/env.js';
import { adminRoutes } from './modules/admin/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { bookmarksRoutes } from './modules/bookmarks/routes.js';
import { certificatesRoutes } from './modules/certificates/routes.js';
import { coursesRoutes } from './modules/courses/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { lessonsRoutes } from './modules/lessons/routes.js';
import { notesRoutes } from './modules/notes/routes.js';
import { quizzesRoutes } from './modules/quizzes/routes.js';
import { reviewsRoutes } from './modules/reviews/routes.js';
import { wordpressWebhookRoutes } from './modules/wordpress/routes.js';
import { registerErrorHandler } from './plugins/error-handler.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export function buildApp(pool: Pool): FastifyInstance {
  const app = Fastify({
    // Accept an inbound request ID from a proxy/load balancer so traces correlate across
    // services; fall back to a real UUID (not Fastify's per-process counter) so IDs stay
    // unique across restarts and multiple instances.
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
    },
  });

  registerErrorHandler(app);

  app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  app.register(cookie);
  app.register(helmet);
  app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-request-id', req.id);
    return payload;
  });

  // Captures the raw bytes alongside the parsed body so webhook routes can verify
  // HMAC signatures over the exact payload the sender signed.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, rawBody, done) => {
    const body = rawBody as Buffer;
    req.rawBody = body;
    if (body.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body.toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get('/api/v1/health', async () => ({ data: { status: 'ok' }, meta: {} }));
  app.register(authRoutes(pool), { prefix: '/api/v1/auth' });
  app.register(coursesRoutes(pool), { prefix: '/api/v1/courses' });
  app.register(lessonsRoutes(pool), { prefix: '/api/v1/lessons' });
  app.register(dashboardRoutes(pool), { prefix: '/api/v1/dashboard' });
  app.register(quizzesRoutes(pool), { prefix: '/api/v1/quizzes' });
  app.register(certificatesRoutes(pool), { prefix: '/api/v1/certificates' });
  app.register(aiRoutes(pool), { prefix: '/api/v1/ai' });
  app.register(adminRoutes(pool), { prefix: '/api/v1/admin' });
  app.register(bookmarksRoutes(pool), { prefix: '/api/v1' });
  app.register(reviewsRoutes(pool), { prefix: '/api/v1' });
  app.register(notesRoutes(pool), { prefix: '/api/v1' });
  app.register(wordpressWebhookRoutes(pool), { prefix: '/api/v1/webhooks' });

  return app;
}
