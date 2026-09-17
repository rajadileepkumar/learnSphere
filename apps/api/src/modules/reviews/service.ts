import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';
import { getCourseIdBySlug, requireEnrollmentBySlug } from '../courses/service.js';
import type { CreateReviewInput, UpdateReviewInput } from './schemas.js';

export interface Review {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  rating: number;
  reviewText: string | null;
  status: string;
  createdAt: string;
}

interface ReviewRow {
  id: string;
  user_id: string;
  user_name: string;
  course_id: string;
  rating: number;
  review_text: string | null;
  status: string;
  created_at: string;
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    courseId: row.course_id,
    rating: row.rating,
    reviewText: row.review_text,
    status: row.status,
    createdAt: row.created_at,
  };
}

const REVIEW_SELECT = `
  SELECT r.id, r.user_id, u.display_name AS user_name, r.course_id, r.rating, r.review_text, r.status, r.created_at
  FROM reviews r
  JOIN users u ON u.id = r.user_id
`;

async function getReviewById(pool: Pool, reviewId: string): Promise<Review | null> {
  const { rows } = await pool.query<ReviewRow>(`${REVIEW_SELECT} WHERE r.id = $1`, [reviewId]);
  return rows[0] ? toReview(rows[0]) : null;
}

// Approved reviews are visible to everyone; a caller also sees their own review regardless
// of its moderation status (so a student can tell their pending/rejected review apart).
export async function listReviewsForCourse(pool: Pool, slug: string, requestingUserId: string | null): Promise<Review[]> {
  const courseId = await getCourseIdBySlug(pool, slug);
  const { rows } = await pool.query<ReviewRow>(
    `${REVIEW_SELECT} WHERE r.course_id = $1 AND (r.status = 'approved' OR r.user_id = $2) ORDER BY r.created_at DESC`,
    [courseId, requestingUserId],
  );
  return rows.map(toReview);
}

export async function createReview(pool: Pool, userId: string, slug: string, input: CreateReviewInput): Promise<Review> {
  const courseId = await requireEnrollmentBySlug(pool, userId, slug);
  const existing = await pool.query('SELECT id FROM reviews WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
  if (existing.rows.length > 0) {
    throw new AppError(409, 'REVIEW_EXISTS', 'You have already reviewed this course');
  }
  const {
    rows: [inserted],
  } = await pool.query<{ id: string }>(
    'INSERT INTO reviews (user_id, course_id, rating, review_text) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, courseId, input.rating, input.reviewText ?? null],
  );
  return (await getReviewById(pool, inserted.id))!;
}

async function getOwnedReview(pool: Pool, userId: string, reviewId: string): Promise<{ rating: number; review_text: string | null }> {
  const { rows } = await pool.query<{ rating: number; review_text: string | null }>(
    'SELECT rating, review_text FROM reviews WHERE id = $1 AND user_id = $2',
    [reviewId, userId],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review could not be found');
  }
  return rows[0];
}

export async function updateReview(pool: Pool, userId: string, reviewId: string, input: UpdateReviewInput): Promise<Review> {
  const existing = await getOwnedReview(pool, userId, reviewId);
  const rating = input.rating ?? existing.rating;
  const reviewText = input.reviewText !== undefined ? input.reviewText : existing.review_text;
  // Editing resets moderation to 'pending' — an edited review shouldn't coast on a stale approval.
  await pool.query('UPDATE reviews SET rating = $2, review_text = $3, status = $4 WHERE id = $1', [
    reviewId,
    rating,
    reviewText,
    'pending',
  ]);
  return (await getReviewById(pool, reviewId))!;
}

export async function deleteReview(pool: Pool, userId: string, reviewId: string): Promise<void> {
  await getOwnedReview(pool, userId, reviewId);
  await pool.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
}
