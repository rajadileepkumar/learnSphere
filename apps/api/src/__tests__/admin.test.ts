import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('admin routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let adminToken: string;
  let studentToken: string;
  let courseId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    const {
      rows: [course],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status, published_at) VALUES (1, 'admin-course', 'Admin Course', 'publish', now()) RETURNING id`,
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
       VALUES ($1, 1, 'lesson', 'Lesson', 'video', 0, true) RETURNING id`,
      [module.id],
    );

    const studentRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'student@admintest.com', password: 'password123', displayName: 'A Student' },
    });
    studentToken = studentRegister.json().data.accessToken;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'admin@admintest.com', password: 'password123', displayName: 'The Admin' },
    });
    await pool.query("UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = 'admin@admintest.com'");
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@admintest.com', password: 'password123' },
    });
    adminToken = adminLogin.json().data.accessToken;

    // Enroll and complete the lesson so analytics has non-zero enrollment/certificate/quiz data.
    await pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ((SELECT id FROM users WHERE email = $1), $2)', [
      'student@admintest.com',
      courseId,
    ]);
    await pool.query(
      `UPDATE enrollments SET completed_at = now() WHERE user_id = (SELECT id FROM users WHERE email = $1) AND course_id = $2`,
      ['student@admintest.com', courseId],
    );
    await pool.query('INSERT INTO certificates (user_id, course_id, certificate_number, verification_code) VALUES ((SELECT id FROM users WHERE email = $1), $2, $3, $4)', [
      'student@admintest.com',
      courseId,
      'LS-TEST-0001',
      'test-verification-code',
    ]);
    void lesson;
  });

  function asAdmin() {
    return { authorization: `Bearer ${adminToken}` };
  }
  function asStudent() {
    return { authorization: `Bearer ${studentToken}` };
  }

  it('requires auth for every admin route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/users' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a non-admin student from every admin route', async () => {
    const users = await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: asStudent() });
    expect(users.statusCode).toBe(403);
    expect(users.json().error.code).toBe('FORBIDDEN');

    const analytics = await app.inject({ method: 'GET', url: '/api/v1/admin/analytics', headers: asStudent() });
    expect(analytics.statusCode).toBe(403);
  });

  it('lists users for an admin', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: asAdmin() });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.total).toBeGreaterThanOrEqual(2);
    expect(res.json().data).toContainEqual(expect.objectContaining({ email: 'student@admintest.com', role: 'STUDENT' }));
  });

  it('lists courses with content status and counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/courses', headers: asAdmin() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toContainEqual(
      expect.objectContaining({ slug: 'admin-course', status: 'publish', moduleCount: 1, lessonCount: 1, enrollmentCount: 1 }),
    );
  });

  it('lists enrollments, optionally filtered by course', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/enrollments', headers: asAdmin() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toContainEqual(
      expect.objectContaining({ userEmail: 'student@admintest.com', courseSlug: 'admin-course' }),
    );

    const filtered = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/enrollments?courseId=${courseId}`,
      headers: asAdmin(),
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().meta.total).toBe(1);
  });

  it('returns platform analytics', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/analytics', headers: asAdmin() });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.totalEnrollments).toBeGreaterThanOrEqual(1);
    expect(body.completedEnrollments).toBeGreaterThanOrEqual(1);
    expect(body.certificatesIssued).toBeGreaterThanOrEqual(1);
  });

  it('revalidates WordPress content cache', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/content/revalidate', headers: asAdmin() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.cleared).toBe(true);
  });
});
