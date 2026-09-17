import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import * as notesService from './service.js';

export function notesRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.get('/notes', async (req) => {
      const notes = await notesService.listNotes(pool, req.user!.id);
      return { data: notes, meta: {} };
    });
  };
}
