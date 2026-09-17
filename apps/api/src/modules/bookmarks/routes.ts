import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import * as bookmarksService from './service.js';

// Registered at the API root (not under /courses) so it can own both /bookmarks and the
// /courses/:courseId/bookmark toggle from specs/06-API-SPEC.md without editing coursesRoutes.
export function bookmarksRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.get('/bookmarks', async (req) => {
      const bookmarks = await bookmarksService.listBookmarks(pool, req.user!.id);
      return { data: bookmarks, meta: {} };
    });

    app.post('/courses/:courseId/bookmark', async (req, reply) => {
      const { courseId: slug } = req.params as { courseId: string };
      const { created, id } = await bookmarksService.addBookmark(pool, req.user!.id, slug);
      reply.status(created ? 201 : 200);
      return { data: { id, bookmarked: true }, meta: {} };
    });

    app.delete('/courses/:courseId/bookmark', async (req, reply) => {
      const { courseId: slug } = req.params as { courseId: string };
      await bookmarksService.removeBookmark(pool, req.user!.id, slug);
      return reply.status(204).send();
    });
  };
}
