import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('certificate routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let accessToken: string;
  let lessonId: string;
  let courseId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    const {
      rows: [course],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (1, 'cert-course', 'Certificate Course', 'publish') RETURNING id`,
    );
    courseId = course.id;
    const {
      rows: [module],
    } = await pool.query<{ id: string }>(
      `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order) VALUES ($1, 1, 'Module', 0) RETURNING id`,
      [course.id],
    );
    const {
      rows: [lesson],
    } = await pool.query<{ id: string }>(
      `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, sort_order, is_required)
       VALUES ($1, 1, 'only-lesson', 'Only Lesson', 'video', 0, true) RETURNING id`,
      [module.id],
    );
    lessonId = lesson.id;

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'certstudent@test.com', password: 'password123', displayName: 'Cert Student' },
    });
    accessToken = register.json().data.accessToken;
  });

  function authed() {
    return { authorization: `Bearer ${accessToken}` };
  }

  it('requires auth to list or fetch certificates', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/certificates' });
    expect(list.statusCode).toBe(401);
  });

  it('has no certificates before completing the course', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/certificates', headers: authed() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it('404s verifying an unknown code', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/certificates/verify/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('CERTIFICATE_NOT_FOUND');
  });

  it('issues a certificate when the course is completed', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/courses/cert-course/enroll', headers: authed() });
    const complete = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${lessonId}/complete`,
      headers: authed(),
    });
    expect(complete.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/api/v1/certificates', headers: authed() });
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0]).toMatchObject({ courseId, courseSlug: 'cert-course' });
  });

  it('does not issue a duplicate certificate on repeated completion', async () => {
    await app.inject({ method: 'POST', url: `/api/v1/lessons/${lessonId}/complete`, headers: authed() });
    const list = await app.inject({ method: 'GET', url: '/api/v1/certificates', headers: authed() });
    expect(list.json().data).toHaveLength(1);
  });

  it('fetches a single certificate by id, scoped to its owner', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/certificates', headers: authed() });
    const certificateId = list.json().data[0].id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/certificates/${certificateId}`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.certificateNumber).toMatch(/^LS-\d{4}-[0-9A-F]{8}$/);

    const otherRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'othercertstudent@test.com', password: 'password123', displayName: 'Other' },
    });
    const otherToken = otherRegister.json().data.accessToken;
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/certificates/${certificateId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(forbidden.statusCode).toBe(404);
  });

  it('verifies a certificate publicly by its verification code', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/certificates', headers: authed() });
    const { verificationCode } = list.json().data[0];

    const res = await app.inject({ method: 'GET', url: `/api/v1/certificates/verify/${verificationCode}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ courseTitle: 'Certificate Course', studentName: 'Cert Student' });
  });
});
