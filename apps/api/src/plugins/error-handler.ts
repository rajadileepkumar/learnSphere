import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        req.log.error({ code: err.code }, err.message);
      }
      return reply
        .status(err.statusCode)
        .send({ error: { code: err.code, message: err.message, requestId: req.id } });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.issues[0]?.message ?? 'Invalid request',
          requestId: req.id,
        },
      });
    }
    const fastifyErr = err as FastifyError;
    const statusCode = fastifyErr.statusCode ?? 500;
    if (statusCode >= 500) {
      req.log.error(fastifyErr);
    }
    return reply.status(statusCode).send({
      error: {
        code: fastifyErr.code ?? 'INTERNAL_ERROR',
        message: fastifyErr.message || 'Something went wrong',
        requestId: req.id,
      },
    });
  });
}
