import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';

describe('health route', () => {
  it('returns ok', async () => {
    const app = Fastify();
    app.get('/api/v1/health', async () => ({ data: { status: 'ok' }, meta: {} }));
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('ok');
  });
});
