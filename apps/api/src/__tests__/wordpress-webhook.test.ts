import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.WORDPRESS_GRAPHQL_URL = 'https://example.test/graphql';
process.env.WORDPRESS_WEBHOOK_SECRET = 'test-webhook-secret';

const { buildApp } = await import('../app.js');
const { createTestPool } = await import('./helpers/test-db.js');

const SECRET = process.env.WORDPRESS_WEBHOOK_SECRET;

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

const mockCourseResponse = {
  data: {
    course: {
      databaseId: 501,
      slug: 'intro-course',
      title: 'Intro Course',
      status: 'publish',
      date: '2024-01-01T00:00:00',
      courseFields: {
        shortDescription: 'short',
        description: 'full',
        duration: 90,
        difficulty: 'beginner',
        category: 'general',
        tags: ['tag1'],
        featured: false,
        seoTitle: null,
        seoDescription: null,
        targetAudience: null,
        learningObjectives: [],
        prerequisites: [],
        featuredImage: { node: { sourceUrl: 'https://example.test/img.jpg' } },
        instructor: null,
      },
      modules: { nodes: [] },
    },
  },
};

describe('wordpress webhook route', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    pool = createTestPool();
    app = buildApp(pool);
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => mockCourseResponse });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a request with an invalid signature', async () => {
    const payload = JSON.stringify({ id: 'evt-bad', event: 'course.published', wpId: 501 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/wordpress',
      headers: { 'content-type': 'application/json', 'x-wp-signature': 'sha256=deadbeef' },
      payload,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_SIGNATURE');
  });

  it('processes a validly signed course.published event and upserts the course', async () => {
    const payload = JSON.stringify({ id: 'evt-1', event: 'course.published', wpId: 501 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/wordpress',
      headers: { 'content-type': 'application/json', 'x-wp-signature': sign(payload) },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('processed');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { rows } = await pool.query('SELECT title, status FROM courses WHERE wp_course_id = $1', [501]);
    expect(rows[0]).toMatchObject({ title: 'Intro Course', status: 'publish' });
  });

  it('does not reprocess a duplicate delivery id', async () => {
    const payload = JSON.stringify({ id: 'evt-1', event: 'course.published', wpId: 501 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/wordpress',
      headers: { 'content-type': 'application/json', 'x-wp-signature': sign(payload) },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('duplicate');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('marks a course unpublished without calling WordPress', async () => {
    const payload = JSON.stringify({ id: 'evt-2', event: 'course.unpublished', wpId: 501 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/wordpress',
      headers: { 'content-type': 'application/json', 'x-wp-signature': sign(payload) },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { rows } = await pool.query('SELECT status FROM courses WHERE wp_course_id = $1', [501]);
    expect(rows[0].status).toBe('unpublished');
  });

  it('rejects a malformed payload', async () => {
    const payload = JSON.stringify({ id: 'evt-3', event: 'not-a-real-event', wpId: 501 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/wordpress',
      headers: { 'content-type': 'application/json', 'x-wp-signature': sign(payload) },
      payload,
    });
    expect(res.statusCode).toBe(400);
  });
});
