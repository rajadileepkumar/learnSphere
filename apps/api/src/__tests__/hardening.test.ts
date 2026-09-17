import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('production hardening', () => {
  let app: FastifyInstance;
  let pool: Pool;

  beforeAll(() => {
    pool = createTestPool();
    app = buildApp(pool);
  });

  it('sets security headers on every response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('echoes a generated request id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('honors an inbound request id for tracing across services', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': 'trace-abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('rate-limits AI messages per user after the threshold', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'ratelimit@test.com', password: 'password123', displayName: 'Rate Limit' },
    });
    const token = register.json().data.accessToken;
    const headers = { authorization: `Bearer ${token}` };

    const convo = await app.inject({ method: 'POST', url: '/api/v1/ai/conversations', headers, payload: {} });
    const conversationId = convo.json().data.id;

    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ai/conversations/${conversationId}/messages`,
        headers,
        payload: { content: `question ${i}` },
      });
      expect(res.statusCode).toBe(200);
    }

    const limited = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${conversationId}/messages`,
      headers,
      payload: { content: 'one too many' },
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
  });
});
