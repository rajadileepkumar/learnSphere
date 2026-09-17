import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('bookmark routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let accessToken: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    await pool.query(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (1, 'bookmark-course', 'Bookmark Course', 'publish')`,
    );

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'bookmarker@test.com', password: 'password123', displayName: 'Bookmarker' },
    });
    accessToken = register.json().data.accessToken;
  });

  function authed() {
    return { authorization: `Bearer ${accessToken}` };
  }

  it('requires auth for every bookmark route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bookmarks' });
    expect(res.statusCode).toBe(401);
  });

  it('has no bookmarks initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bookmarks', headers: authed() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it('404s bookmarking an unknown course', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/courses/does-not-exist/bookmark', headers: authed() });
    expect(res.statusCode).toBe(404);
  });

  it('bookmarks a course without requiring enrollment', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/courses/bookmark-course/bookmark', headers: authed() });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.bookmarked).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/api/v1/bookmarks', headers: authed() });
    expect(list.json().data).toContainEqual(expect.objectContaining({ slug: 'bookmark-course' }));
  });

  it('is idempotent when bookmarking the same course twice', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/courses/bookmark-course/bookmark', headers: authed() });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/api/v1/bookmarks', headers: authed() });
    expect(list.json().data).toHaveLength(1);
  });

  it('removes a bookmark', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/courses/bookmark-course/bookmark', headers: authed() });
    expect(res.statusCode).toBe(204);

    const list = await app.inject({ method: 'GET', url: '/api/v1/bookmarks', headers: authed() });
    expect(list.json().data).toHaveLength(0);
  });

  it('is idempotent removing a bookmark that no longer exists', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/courses/bookmark-course/bookmark', headers: authed() });
    expect(res.statusCode).toBe(204);
  });
});
