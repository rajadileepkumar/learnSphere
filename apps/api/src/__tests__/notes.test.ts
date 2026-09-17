import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('notes list route', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let accessToken: string;
  let lessonAId: string;
  let lessonBId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    const {
      rows: [course],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (1, 'notes-list-course', 'Notes List Course', 'publish') RETURNING id`,
    );
    const {
      rows: [module],
    } = await pool.query<{ id: string }>(
      `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order) VALUES ($1, 1, 'Module', 0) RETURNING id`,
      [course.id],
    );
    const { rows: lessons } = await pool.query<{ id: string }>(
      `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, sort_order, is_required)
       VALUES
         ($1, 1, 'lesson-a', 'Lesson A', 'video', 0, true),
         ($1, 2, 'lesson-b', 'Lesson B', 'video', 1, true)
       RETURNING id`,
      [module.id],
    );
    lessonAId = lessons[0].id;
    lessonBId = lessons[1].id;

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'noteslist@test.com', password: 'password123', displayName: 'Notes List' },
    });
    accessToken = register.json().data.accessToken;

    await pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ((SELECT id FROM users WHERE email = $1), $2)', [
      'noteslist@test.com',
      course.id,
    ]);
  });

  function authed() {
    return { authorization: `Bearer ${accessToken}` };
  }

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notes' });
    expect(res.statusCode).toBe(401);
  });

  it('has no notes initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notes', headers: authed() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it('excludes a note that was saved blank', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${lessonAId}/notes`,
      headers: authed(),
      payload: { content: '' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/notes', headers: authed() });
    expect(res.json().data).toHaveLength(0);
  });

  it('lists notes across lessons with course context, most recent first', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${lessonAId}/notes`,
      headers: authed(),
      payload: { content: 'Note on lesson A' },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${lessonBId}/notes`,
      headers: authed(),
      payload: { content: 'Note on lesson B' },
    });

    const res = await app.inject({ method: 'GET', url: '/api/v1/notes', headers: authed() });
    expect(res.statusCode).toBe(200);
    const notes = res.json().data;
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({
      lessonId: lessonBId,
      lessonTitle: 'Lesson B',
      courseSlug: 'notes-list-course',
      courseTitle: 'Notes List Course',
      content: 'Note on lesson B',
    });
    expect(notes[1].lessonId).toBe(lessonAId);
  });
});
