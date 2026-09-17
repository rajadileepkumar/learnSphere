import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';
import { authenticate } from '../../middleware/authenticate.js';
import { listCoursesQuerySchema } from './schemas.js';
import * as coursesService from './service.js';

// The :courseId path segment (per specs/06-API-SPEC.md) is resolved as a course slug —
// slugs are the stable, public-facing identifier; the Neon UUID stays an internal detail.
export function coursesRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.get('/', async (req) => {
      const query = listCoursesQuerySchema.parse(req.query);
      const { items, total } = await coursesService.listCourses(pool, query);
      return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
    });

    app.get('/:courseId', async (req) => {
      const { courseId: slug } = req.params as { courseId: string };
      const course = await coursesService.getCourseBySlug(pool, slug);
      if (!course) {
        throw new AppError(404, 'COURSE_NOT_FOUND', 'Course could not be found');
      }
      return { data: course, meta: {} };
    });

    app.get('/:courseId/progress', { preHandler: authenticate }, async (req) => {
      const { courseId: slug } = req.params as { courseId: string };
      const progress = await coursesService.getCourseProgress(pool, req.user!.id, slug);
      return { data: progress, meta: {} };
    });

    app.post('/:courseId/enroll', { preHandler: authenticate }, async (req, reply) => {
      const { courseId: slug } = req.params as { courseId: string };
      const { created, enrollment } = await coursesService.enrollBySlug(pool, req.user!.id, slug);
      reply.status(created ? 201 : 200);
      return { data: enrollment, meta: {} };
    });
  };
}
