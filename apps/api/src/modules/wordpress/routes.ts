import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { invalidateCache } from './cache.js';
import { webhookPayloadSchema } from './schemas.js';
import { verifyWebhookSignature } from './signature.js';
import { markCourseUnpublished, recordWebhookEvent, syncCourse, syncLesson } from './sync.js';

async function processEvent(pool: Pool, payload: { event: string; wpId: number }): Promise<void> {
  switch (payload.event) {
    case 'course.published':
    case 'course.updated':
      await syncCourse(pool, payload.wpId);
      break;
    case 'course.unpublished':
      await markCourseUnpublished(pool, payload.wpId);
      break;
    case 'lesson.updated':
      await syncLesson(pool, payload.wpId);
      break;
    case 'instructor.updated':
      invalidateCache('instructor:');
      break;
  }
}

export function wordpressWebhookRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.post('/wordpress', async (req) => {
      const signature = req.headers['x-wp-signature'];
      if (!verifyWebhookSignature(env.WORDPRESS_WEBHOOK_SECRET, req.rawBody ?? Buffer.alloc(0), signature)) {
        throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
      }

      const payload = webhookPayloadSchema.parse(req.body);
      const isNew = await recordWebhookEvent(pool, payload.id, 'wordpress', payload.event);
      if (!isNew) {
        return { data: { status: 'duplicate' }, meta: {} };
      }

      await processEvent(pool, payload);
      return { data: { status: 'processed' }, meta: {} };
    });
  };
}
