import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('student learning routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let accessToken: string;
  let requiredLessonId: string;
  let optionalLessonId: string;
  let otherCourseLessonId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    const {
      rows: [course],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status, thumbnail_url, duration_minutes, difficulty, published_at)
       VALUES (1, 'intro-course', 'Intro Course', 'publish', 'https://example.test/thumb.jpg', 60, 'beginner', now())
       RETURNING id`,
    );
    const {
      rows: [module],
    } = await pool.query<{ id: string }>(
      `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order) VALUES ($1, 1, 'Getting Started', 0) RETURNING id`,
      [course.id],
    );
    const {
      rows: [required],
    } = await pool.query<{ id: string }>(
      `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, duration_minutes, sort_order, is_required)
       VALUES ($1, 1, 'welcome', 'Welcome', 'video', 5, 0, true) RETURNING id`,
      [module.id],
    );
    const {
      rows: [optional],
    } = await pool.query<{ id: string }>(
      `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, duration_minutes, sort_order, is_required)
       VALUES ($1, 2, 'bonus', 'Bonus', 'reading', 10, 1, false) RETURNING id`,
      [module.id],
    );
    requiredLessonId = required.id;
    optionalLessonId = optional.id;

    const {
      rows: [otherCourse],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status)
       VALUES (2, 'other-course', 'Other Course', 'publish') RETURNING id`,
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
       VALUES ($1, 3, 'lesson', 'Lesson', 'video', 0, true) RETURNING id`,
      [otherModule.id],
    );
    otherCourseLessonId = otherLesson.id;

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'student@test.com', password: 'password123', displayName: 'Student' },
    });
    accessToken = register.json().data.accessToken;
  });

  function authed(headers: Record<string, string> = {}) {
    return { authorization: `Bearer ${accessToken}`, ...headers };
  }

  it('lists published courses', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/courses' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(body.data).toContainEqual(
      expect.objectContaining({ slug: 'intro-course', title: 'Intro Course', difficulty: 'beginner' }),
    );
  });

  it('returns course detail with nested curriculum', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/courses/intro-course' });
    expect(res.statusCode).toBe(200);
    const course = res.json().data;
    expect(course.title).toBe('Intro Course');
    expect(course.modules).toHaveLength(1);
    expect(course.modules[0].lessons).toHaveLength(2);
  });

  it('404s for an unknown course slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/courses/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('COURSE_NOT_FOUND');
  });

  it('requires auth to view course progress or enroll', async () => {
    const progress = await app.inject({ method: 'GET', url: '/api/v1/courses/intro-course/progress' });
    expect(progress.statusCode).toBe(401);

    const enroll = await app.inject({ method: 'POST', url: '/api/v1/courses/intro-course/enroll' });
    expect(enroll.statusCode).toBe(401);
  });

  it('enrolls a student idempotently', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/intro-course/enroll',
      headers: authed(),
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/intro-course/enroll',
      headers: authed(),
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().data.id).toBe(first.json().data.id);
  });

  it('returns per-lesson progress once enrolled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/courses/intro-course/progress',
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.lessons).toHaveLength(2);
    expect(res.json().data.overallPercent).toBe(0);
  });

  it('fetches a single lesson', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/lessons/${requiredLessonId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('Welcome');
    expect(res.json().data.quizId).toBeNull();
  });

  it('reports whether a lesson is required', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/lessons/${optionalLessonId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.isRequired).toBe(false);
  });

  it('rejects progress updates for a course the student is not enrolled in', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${otherCourseLessonId}/progress`,
      headers: authed(),
      payload: { progressPercent: 50 },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NOT_ENROLLED');
  });

  it('rejects an empty progress payload', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${requiredLessonId}/progress`,
      headers: authed(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('records partial progress on an enrolled lesson', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${requiredLessonId}/progress`,
      headers: authed(),
      payload: { progressPercent: 40, lastPositionSeconds: 90 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('in_progress');
  });

  it('completes the required lesson and marks the course complete', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${requiredLessonId}/complete`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('completed');

    const { rows } = await pool.query('SELECT completed_at FROM enrollments WHERE user_id = (SELECT id FROM users WHERE email = $1)', [
      'student@test.com',
    ]);
    expect(rows[0].completed_at).not.toBeNull();
  });

  it('reflects the completed course on the dashboard', async () => {
    const summary = await app.inject({ method: 'GET', url: '/api/v1/dashboard/summary', headers: authed() });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().data.completedCourses).toBe(1);
    // 1 of 2 lessons in the course is done (the untouched optional lesson counts as 0%),
    // not 100% — a plain AVG() over the LEFT JOIN would wrongly drop it and show 100%.
    expect(summary.json().data.overallProgressPercent).toBe(50);

    const myCourses = await app.inject({ method: 'GET', url: '/api/v1/dashboard/my-courses', headers: authed() });
    expect(myCourses.statusCode).toBe(200);
    expect(myCourses.json().data).toHaveLength(1);
    expect(myCourses.json().data[0]).toMatchObject({
      slug: 'intro-course',
      title: 'Intro Course',
      progressPercent: 50,
    });
    expect(myCourses.json().data[0].completedAt).not.toBeNull();

    const activity = await app.inject({ method: 'GET', url: '/api/v1/dashboard/activity', headers: authed() });
    expect(activity.statusCode).toBe(200);
    expect(activity.json().data.length).toBeGreaterThan(0);
  });

  it('requires auth for dashboard routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard/summary' });
    expect(res.statusCode).toBe(401);
  });
});
