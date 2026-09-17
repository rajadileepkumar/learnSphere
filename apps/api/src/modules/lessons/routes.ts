import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import { lessonNoteSchema, lessonProgressSchema } from './schemas.js';
import * as lessonsService from './service.js';

export function lessonsRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.get('/:lessonId', async (req) => {
      const { lessonId } = req.params as { lessonId: string };
      const lesson = await lessonsService.getLesson(pool, lessonId);
      return { data: lesson, meta: {} };
    });

    app.put('/:lessonId/progress', { preHandler: authenticate }, async (req) => {
      const { lessonId } = req.params as { lessonId: string };
      const input = lessonProgressSchema.parse(req.body);
      const progress = await lessonsService.upsertLessonProgress(pool, req.user!.id, lessonId, input);
      return { data: progress, meta: {} };
    });

    app.post('/:lessonId/complete', { preHandler: authenticate }, async (req) => {
      const { lessonId } = req.params as { lessonId: string };
      const progress = await lessonsService.completeLesson(pool, req.user!.id, lessonId);
      return { data: progress, meta: {} };
    });

    app.get('/:lessonId/notes', { preHandler: authenticate }, async (req) => {
      const { lessonId } = req.params as { lessonId: string };
      const note = await lessonsService.getLessonNote(pool, req.user!.id, lessonId);
      return { data: note, meta: {} };
    });

    app.put('/:lessonId/notes', { preHandler: authenticate }, async (req) => {
      const { lessonId } = req.params as { lessonId: string };
      const input = lessonNoteSchema.parse(req.body);
      const note = await lessonsService.upsertLessonNote(pool, req.user!.id, lessonId, input);
      return { data: note, meta: {} };
    });
  };
}
