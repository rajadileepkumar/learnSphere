import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import * as certificatesService from './service.js';

export function certificatesRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.get('/verify/:verificationCode', async (req) => {
      const { verificationCode } = req.params as { verificationCode: string };
      const result = await certificatesService.verifyCertificate(pool, verificationCode);
      return { data: result, meta: {} };
    });

    app.get('/', { preHandler: authenticate }, async (req) => {
      const certificates = await certificatesService.listCertificates(pool, req.user!.id);
      return { data: certificates, meta: {} };
    });

    app.get('/:certificateId', { preHandler: authenticate }, async (req) => {
      const { certificateId } = req.params as { certificateId: string };
      const certificate = await certificatesService.getCertificateById(pool, req.user!.id, certificateId);
      return { data: certificate, meta: {} };
    });
  };
}
