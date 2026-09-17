import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { clearCache } from '../wordpress/cache.js';
import * as adminService from './service.js';
import { listEnrollmentsQuerySchema, listReviewsQuerySchema, moderateReviewSchema, paginationQuerySchema } from './schemas.js';

export function adminRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.addHook('preHandler', authenticate);
    app.addHook('preHandler', requireRole('CONTENT_ADMIN', 'PLATFORM_ADMIN'));

    app.get('/users', async (req) => {
      const query = paginationQuerySchema.parse(req.query);
      const { items, total } = await adminService.listUsers(pool, query);
      return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
    });

    app.get('/courses', async (req) => {
      const query = paginationQuerySchema.parse(req.query);
      const { items, total } = await adminService.listCourses(pool, query);
      return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
    });

    app.get('/enrollments', async (req) => {
      const query = listEnrollmentsQuerySchema.parse(req.query);
      const { items, total } = await adminService.listEnrollments(pool, query);
      return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
    });

    app.get('/analytics', async () => {
      const analytics = await adminService.getAnalytics(pool);
      return { data: analytics, meta: {} };
    });

    app.get('/reviews', async (req) => {
      const query = listReviewsQuerySchema.parse(req.query);
      const { items, total } = await adminService.listReviews(pool, query);
      return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
    });

    app.post('/reviews/:reviewId/moderate', async (req) => {
      const { reviewId } = req.params as { reviewId: string };
      const input = moderateReviewSchema.parse(req.body);
      const review = await adminService.moderateReview(pool, reviewId, input.status);
      req.log.info(
        { event: 'admin_action', action: 'review_moderate', adminId: req.user!.id, reviewId, status: input.status },
        'admin action',
      );
      return { data: review, meta: {} };
    });

    // Busts the in-memory WordPress cache so the next read picks up freshly published content.
    app.post('/content/revalidate', async (req) => {
      req.log.info({ event: 'admin_action', action: 'content_revalidate', adminId: req.user!.id }, 'admin action');
      clearCache();
      return { data: { cleared: true }, meta: {} };
    });
  };
}
