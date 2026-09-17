import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import { submitAttemptSchema } from './schemas.js';
import * as quizzesService from './service.js';

export function quizzesRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.get('/:quizId', async (req) => {
      const { quizId } = req.params as { quizId: string };
      const quiz = await quizzesService.getQuizForStudent(pool, req.user!.id, quizId);
      return { data: quiz, meta: {} };
    });

    app.post('/:quizId/attempts', async (req, reply) => {
      const { quizId } = req.params as { quizId: string };
      const { created, attempt } = await quizzesService.createAttempt(pool, req.user!.id, quizId);
      reply.status(created ? 201 : 200);
      return { data: attempt, meta: {} };
    });

    app.post('/:quizId/attempts/:attemptId/submit', async (req) => {
      const { quizId, attemptId } = req.params as { quizId: string; attemptId: string };
      const input = submitAttemptSchema.parse(req.body);
      const result = await quizzesService.submitAttempt(pool, req.user!.id, quizId, attemptId, input);
      return { data: result, meta: {} };
    });

    app.get('/:quizId/results', async (req) => {
      const { quizId } = req.params as { quizId: string };
      const results = await quizzesService.getResults(pool, req.user!.id, quizId);
      return { data: results, meta: {} };
    });
  };
}
