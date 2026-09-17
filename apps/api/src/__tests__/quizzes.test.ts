import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('quiz routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let accessToken: string;
  let lessonId: string;
  let quizId: string;
  let questionAId: string;
  let questionBId: string;
  let aCorrectOptionId: string;
  let aWrongOptionId: string;
  let bCorrectOptionId: string;
  let bWrongOptionId: string;
  let otherQuizId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    const {
      rows: [course],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (1, 'quiz-course', 'Quiz Course', 'publish') RETURNING id`,
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
      rows: [quiz],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quizzes (lesson_id, passing_score, max_attempts) VALUES ($1, 50, 2) RETURNING id`,
      [lesson.id],
    );
    quizId = quiz.id;

    const {
      rows: [qa],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quiz_questions (quiz_id, question_text, question_type, sort_order) VALUES ($1, 'What is 2+2?', 'single_choice', 0) RETURNING id`,
      [quizId],
    );
    questionAId = qa.id;
    const {
      rows: [qb],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quiz_questions (quiz_id, question_text, question_type, sort_order) VALUES ($1, 'What is 3+3?', 'single_choice', 1) RETURNING id`,
      [quizId],
    );
    questionBId = qb.id;

    const {
      rows: [ac],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, '4', true) RETURNING id`,
      [questionAId],
    );
    aCorrectOptionId = ac.id;
    const {
      rows: [aw],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, '5', false) RETURNING id`,
      [questionAId],
    );
    aWrongOptionId = aw.id;
    const {
      rows: [bc],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, '6', true) RETURNING id`,
      [questionBId],
    );
    bCorrectOptionId = bc.id;
    const {
      rows: [bw],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, '7', false) RETURNING id`,
      [questionBId],
    );
    bWrongOptionId = bw.id;

    const {
      rows: [otherCourse],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (2, 'other-quiz-course', 'Other Quiz Course', 'publish') RETURNING id`,
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
    const {
      rows: [otherQuiz],
    } = await pool.query<{ id: string }>(
      `INSERT INTO quizzes (lesson_id, passing_score, max_attempts) VALUES ($1, 50, null) RETURNING id`,
      [otherLesson.id],
    );
    otherQuizId = otherQuiz.id;

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'quizstudent@test.com', password: 'password123', displayName: 'Quiz Student' },
    });
    accessToken = register.json().data.accessToken;

    await pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ((SELECT id FROM users WHERE email = $1), $2)', [
      'quizstudent@test.com',
      course.id,
    ]);
  });

  function authed() {
    return { authorization: `Bearer ${accessToken}` };
  }

  it('requires auth for every quiz route', async () => {
    const get = await app.inject({ method: 'GET', url: `/api/v1/quizzes/${quizId}` });
    expect(get.statusCode).toBe(401);
    const attempt = await app.inject({ method: 'POST', url: `/api/v1/quizzes/${quizId}/attempts` });
    expect(attempt.statusCode).toBe(401);
    const results = await app.inject({ method: 'GET', url: `/api/v1/quizzes/${quizId}/results` });
    expect(results.statusCode).toBe(401);
  });

  it('rejects access to a quiz in a course the student is not enrolled in', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/quizzes/${otherQuizId}`, headers: authed() });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NOT_ENROLLED');
  });

  it('exposes the quiz id on the lesson so a client can discover it', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/lessons/${lessonId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.quizId).toBe(quizId);
  });

  it('404s for an unknown quiz', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/quizzes/00000000-0000-0000-0000-000000000000',
      headers: authed(),
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns quiz questions without leaking correct answers', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/quizzes/${quizId}`, headers: authed() });
    expect(res.statusCode).toBe(200);
    const quiz = res.json().data;
    expect(quiz.questions).toHaveLength(2);
    for (const question of quiz.questions) {
      for (const option of question.options) {
        expect(option).not.toHaveProperty('isCorrect');
        expect(option).not.toHaveProperty('is_correct');
      }
    }
  });

  let attempt1Id: string;

  it('creates an attempt and resumes the same open attempt on a second call', async () => {
    const first = await app.inject({ method: 'POST', url: `/api/v1/quizzes/${quizId}/attempts`, headers: authed() });
    expect(first.statusCode).toBe(201);
    expect(first.json().data.attemptNumber).toBe(1);
    attempt1Id = first.json().data.id;

    const second = await app.inject({ method: 'POST', url: `/api/v1/quizzes/${quizId}/attempts`, headers: authed() });
    expect(second.statusCode).toBe(200);
    expect(second.json().data.id).toBe(attempt1Id);
  });

  it('rejects a submission that references an answer outside the quiz', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quizId}/attempts/${attempt1Id}/submit`,
      headers: authed(),
      payload: { answers: [{ questionId: '00000000-0000-0000-0000-000000000000', optionIds: [aCorrectOptionId] }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_ANSWER');
  });

  it('scores a fully correct submission as passed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quizId}/attempts/${attempt1Id}/submit`,
      headers: authed(),
      payload: {
        answers: [
          { questionId: questionAId, optionIds: [aCorrectOptionId] },
          { questionId: questionBId, optionIds: [bCorrectOptionId] },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.score).toBe(100);
    expect(body.passed).toBe(true);
    expect(body.correctCount).toBe(2);
    expect(body.results.every((r: { correct: boolean }) => r.correct)).toBe(true);
  });

  it('rejects resubmitting an already-submitted attempt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quizId}/attempts/${attempt1Id}/submit`,
      headers: authed(),
      payload: { answers: [{ questionId: questionAId, optionIds: [aCorrectOptionId] }] },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ALREADY_SUBMITTED');
  });

  let attempt2Id: string;

  it('starts a second attempt and scores a fully wrong submission as failed', async () => {
    const created = await app.inject({ method: 'POST', url: `/api/v1/quizzes/${quizId}/attempts`, headers: authed() });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.attemptNumber).toBe(2);
    attempt2Id = created.json().data.id;

    const submitted = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quizId}/attempts/${attempt2Id}/submit`,
      headers: authed(),
      payload: {
        answers: [
          { questionId: questionAId, optionIds: [aWrongOptionId] },
          { questionId: questionBId, optionIds: [bWrongOptionId] },
        ],
      },
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().data.score).toBe(0);
    expect(submitted.json().data.passed).toBe(false);
  });

  it('enforces the max attempt limit', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/v1/quizzes/${quizId}/attempts`, headers: authed() });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('ATTEMPT_LIMIT_REACHED');
  });

  it('lists both attempts in the results history', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/quizzes/${quizId}/results`, headers: authed() });
    expect(res.statusCode).toBe(200);
    const results = res.json().data;
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ attemptNumber: 1, score: 100, passed: true });
    expect(results[1]).toMatchObject({ attemptNumber: 2, score: 0, passed: false });
  });
});
