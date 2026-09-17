import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import * as dashboardService from './service.js';

export function dashboardRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.get('/summary', async (req) => {
      const summary = await dashboardService.getSummary(pool, req.user!.id);
      return { data: summary, meta: {} };
    });

    app.get('/my-courses', async (req) => {
      const courses = await dashboardService.getMyCourses(pool, req.user!.id);
      return { data: courses, meta: {} };
    });

    app.get('/activity', async (req) => {
      const activity = await dashboardService.getActivity(pool, req.user!.id);
      return { data: activity, meta: {} };
    });
  };
}
