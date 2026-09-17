import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

// ponytail: in-memory sliding window, single Node process only — swap for a shared store
// (e.g. Redis) once the API runs as more than one instance and the limit must hold across them.
export function createUserRateLimiter(max: number, windowMs: number) {
  const hitsByUser = new Map<string, number[]>();

  return async (req: FastifyRequest): Promise<void> => {
    const key = req.user!.id;
    const now = Date.now();
    const recentHits = (hitsByUser.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recentHits.length >= max) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests — please slow down and try again shortly');
    }
    recentHits.push(now);
    hitsByUser.set(key, recentHits);
  };
}
