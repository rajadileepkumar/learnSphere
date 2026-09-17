import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import { verifyAccessToken } from '../auth/tokens.js';
import * as reviewsService from './service.js';
import { createReviewSchema, updateReviewSchema } from './schemas.js';

// The course reviews list is public but still shows a caller their own pending/rejected
// review, so it decodes a bearer token if present without requiring one.
function optionalUserId(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyAccessToken(header.slice('Bearer '.length)).sub;
  } catch {
    return null;
  }
}

// Registered at the API root (not under /courses) so it can own both the nested
// /courses/:courseId/reviews paths and the flat /reviews/:reviewId paths from
// specs/06-API-SPEC.md without editing coursesRoutes.
export function reviewsRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.get('/courses/:courseId/reviews', async (req) => {
      const { courseId: slug } = req.params as { courseId: string };
      const reviews = await reviewsService.listReviewsForCourse(pool, slug, optionalUserId(req));
      return { data: reviews, meta: {} };
    });

    app.post('/courses/:courseId/reviews', { preHandler: authenticate }, async (req, reply) => {
      const { courseId: slug } = req.params as { courseId: string };
      const input = createReviewSchema.parse(req.body);
      const review = await reviewsService.createReview(pool, req.user!.id, slug, input);
      reply.status(201);
      return { data: review, meta: {} };
    });

    app.put('/reviews/:reviewId', { preHandler: authenticate }, async (req) => {
      const { reviewId } = req.params as { reviewId: string };
      const input = updateReviewSchema.parse(req.body);
      const review = await reviewsService.updateReview(pool, req.user!.id, reviewId, input);
      return { data: review, meta: {} };
    });

    app.delete('/reviews/:reviewId', { preHandler: authenticate }, async (req, reply) => {
      const { reviewId } = req.params as { reviewId: string };
      await reviewsService.deleteReview(pool, req.user!.id, reviewId);
      return reply.status(204).send();
    });
  };
}
