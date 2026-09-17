import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestPool } from './helpers/test-db.js';

describe('review routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let studentToken: string;
  let otherStudentToken: string;
  let adminToken: string;
  let reviewId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    await pool.query(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (1, 'review-course', 'Review Course', 'publish')`,
    );

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'reviewer@test.com', password: 'password123', displayName: 'Reviewer' },
    });
    studentToken = register.json().data.accessToken;

    const otherRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'otherreviewer@test.com', password: 'password123', displayName: 'Other Reviewer' },
    });
    otherStudentToken = otherRegister.json().data.accessToken;

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'reviewadmin@test.com', password: 'password123', displayName: 'Review Admin' },
    });
    await pool.query("UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = 'reviewadmin@test.com'");
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'reviewadmin@test.com', password: 'password123' },
    });
    adminToken = adminLogin.json().data.accessToken;
  });

  function asStudent() {
    return { authorization: `Bearer ${studentToken}` };
  }
  function asOtherStudent() {
    return { authorization: `Bearer ${otherStudentToken}` };
  }
  function asAdmin() {
    return { authorization: `Bearer ${adminToken}` };
  }

  it('rejects a review from a student who is not enrolled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/review-course/reviews',
      headers: asStudent(),
      payload: { rating: 5, reviewText: 'Great course' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NOT_ENROLLED');
  });

  it('creates a review once enrolled, defaulting to pending', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/courses/review-course/enroll', headers: asStudent() });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/review-course/reviews',
      headers: asStudent(),
      payload: { rating: 5, reviewText: 'Great course' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ rating: 5, reviewText: 'Great course', status: 'pending' });
    reviewId = res.json().data.id;
  });

  it('rejects a second review from the same student for the same course', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/review-course/reviews',
      headers: asStudent(),
      payload: { rating: 3 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REVIEW_EXISTS');
  });

  it('hides a pending review from the public but shows it to its author', async () => {
    const publicView = await app.inject({ method: 'GET', url: '/api/v1/courses/review-course/reviews' });
    expect(publicView.json().data).toHaveLength(0);

    const ownView = await app.inject({
      method: 'GET',
      url: '/api/v1/courses/review-course/reviews',
      headers: asStudent(),
    });
    expect(ownView.json().data).toHaveLength(1);
  });

  it('rejects editing or deleting a review that belongs to someone else', async () => {
    const edit = await app.inject({
      method: 'PUT',
      url: `/api/v1/reviews/${reviewId}`,
      headers: asOtherStudent(),
      payload: { rating: 1 },
    });
    expect(edit.statusCode).toBe(404);

    const del = await app.inject({ method: 'DELETE', url: `/api/v1/reviews/${reviewId}`, headers: asOtherStudent() });
    expect(del.statusCode).toBe(404);
  });

  it('lists the pending review for admin moderation and approves it', async () => {
    const pending = await app.inject({ method: 'GET', url: '/api/v1/admin/reviews?status=pending', headers: asAdmin() });
    expect(pending.statusCode).toBe(200);
    expect(pending.json().data).toContainEqual(expect.objectContaining({ id: reviewId, courseTitle: 'Review Course' }));

    const moderated = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reviews/${reviewId}/moderate`,
      headers: asAdmin(),
      payload: { status: 'approved' },
    });
    expect(moderated.statusCode).toBe(200);
    expect(moderated.json().data.status).toBe('approved');
  });

  it('shows an approved review to the public', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/courses/review-course/reviews' });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0]).toMatchObject({ status: 'approved', rating: 5 });
  });

  it('rejects a non-admin from moderating reviews', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reviews/${reviewId}/moderate`,
      headers: asStudent(),
      payload: { status: 'rejected' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('resets an edited review back to pending', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/reviews/${reviewId}`,
      headers: asStudent(),
      payload: { reviewText: 'Updated thoughts' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ status: 'pending', reviewText: 'Updated thoughts', rating: 5 });

    const publicView = await app.inject({ method: 'GET', url: '/api/v1/courses/review-course/reviews' });
    expect(publicView.json().data).toHaveLength(0);
  });

  it('deletes a review', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/reviews/${reviewId}`, headers: asStudent() });
    expect(res.statusCode).toBe(204);

    const ownView = await app.inject({
      method: 'GET',
      url: '/api/v1/courses/review-course/reviews',
      headers: asStudent(),
    });
    expect(ownView.json().data).toHaveLength(0);
  });
});
