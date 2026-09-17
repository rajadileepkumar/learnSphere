import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('lesson notes routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let accessToken: string;
  let lessonId: string;
  let otherCourseLessonId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    const {
      rows: [course],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (1, 'notes-course', 'Notes Course', 'publish') RETURNING id`,
    );
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
    lessonId = lesson.id;

    const {
      rows: [otherCourse],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (2, 'other-notes-course', 'Other Course', 'publish') RETURNING id`,
    );
    const {
      rows: [otherModule],
    } = await pool.query<{ id: string }>(
      `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order) VALUES ($1, 1, 'Module', 0) RETURNING id`,
      [otherCourse.id],
    );
    const {
      rows: [otherLesson],
    } = await pool.query<{ id: string }>(
      `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, sort_order, is_required)
       VALUES ($1, 2, 'other-lesson', 'Other Lesson', 'video', 0, true) RETURNING id`,
      [otherModule.id],
    );
    otherCourseLessonId = otherLesson.id;

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'notetaker@test.com', password: 'password123', displayName: 'Note Taker' },
    });
    accessToken = register.json().data.accessToken;

    await pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ((SELECT id FROM users WHERE email = $1), $2)', [
      'notetaker@test.com',
      course.id,
    ]);
  });

  function authed() {
    return { authorization: `Bearer ${accessToken}` };
  }

  it('requires auth to read or write notes', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/lessons/${lessonId}/notes` });
    expect(res.statusCode).toBe(401);
  });

  it('returns an empty note before one is saved', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/lessons/${lessonId}/notes`, headers: authed() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ content: '', updatedAt: null });
  });

  it('rejects notes for a lesson in a course the student is not enrolled in', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${otherCourseLessonId}/notes`,
      headers: authed(),
      payload: { content: 'sneaky' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NOT_ENROLLED');
  });

  it('saves a note and reads it back', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${lessonId}/notes`,
      headers: authed(),
      payload: { content: 'Remember: closures capture variables by reference.' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().data.content).toBe('Remember: closures capture variables by reference.');
    expect(put.json().data.updatedAt).not.toBeNull();

    const get = await app.inject({ method: 'GET', url: `/api/v1/lessons/${lessonId}/notes`, headers: authed() });
    expect(get.json().data.content).toBe('Remember: closures capture variables by reference.');
  });

  it('overwrites the note on a second save rather than creating a duplicate', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${lessonId}/notes`,
      headers: authed(),
      payload: { content: 'Updated note.' },
    });
    const res = await app.inject({ method: 'GET', url: `/api/v1/lessons/${lessonId}/notes`, headers: authed() });
    expect(res.json().data.content).toBe('Updated note.');

    const { rows } = await pool.query('SELECT count(*) FROM lesson_notes WHERE lesson_id = $1', [lessonId]);
    expect(Number(rows[0].count)).toBe(1);
  });
});
