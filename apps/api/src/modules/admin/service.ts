import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';
import type { ListEnrollmentsQuery, ListReviewsQuery, PaginationQuery } from './schemas.js';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

export async function listUsers(pool: Pool, { page, pageSize }: PaginationQuery): Promise<{ items: AdminUser[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const { rows } = await pool.query(
    `SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );
  const {
    rows: [{ count }],
  } = await pool.query<{ count: string }>('SELECT count(*) FROM users');

  return {
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    })),
    total: Number(count),
  };
}

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
  moduleCount: number;
  lessonCount: number;
  enrollmentCount: number;
}

async function countByCourseId(pool: Pool, sql: string, courseIds: string[]): Promise<Map<string, number>> {
  const placeholders = courseIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query<{ course_id: string; count: string }>(sql.replace('%IDS%', placeholders), courseIds);
  return new Map(rows.map((row) => [row.course_id, Number(row.count)]));
}

export async function listCourses(pool: Pool, { page, pageSize }: PaginationQuery): Promise<{ items: AdminCourse[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const { rows } = await pool.query(
    `SELECT id, slug, title, status, published_at FROM courses ORDER BY published_at DESC NULLS LAST LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );
  const {
    rows: [{ count }],
  } = await pool.query<{ count: string }>('SELECT count(*) FROM courses');

  // ponytail: batched IN(...) lookups instead of LEFT JOIN + COUNT(DISTINCT ...) — pg-mem's
  // aggregation engine crashes on COUNT(DISTINCT) across joins and doesn't support correlated
  // subqueries in the SELECT list, so this stays plain GROUP BY per relation, merged in JS.
  const courseIds = rows.map((row) => row.id);
  const [moduleCounts, lessonCounts, enrollmentCounts] = courseIds.length
    ? await Promise.all([
        countByCourseId(pool, 'SELECT course_id, count(*) FROM course_modules WHERE course_id IN (%IDS%) GROUP BY course_id', courseIds),
        countByCourseId(
          pool,
          `SELECT m.course_id, count(*) FROM lessons l JOIN course_modules m ON m.id = l.module_id WHERE m.course_id IN (%IDS%) GROUP BY m.course_id`,
          courseIds,
        ),
        countByCourseId(pool, 'SELECT course_id, count(*) FROM enrollments WHERE course_id IN (%IDS%) GROUP BY course_id', courseIds),
      ])
    : [new Map(), new Map(), new Map()];

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      publishedAt: row.published_at,
      moduleCount: moduleCounts.get(row.id) ?? 0,
      lessonCount: lessonCounts.get(row.id) ?? 0,
      enrollmentCount: enrollmentCounts.get(row.id) ?? 0,
    })),
    total: Number(count),
  };
}

export interface AdminEnrollment {
  id: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

export async function listEnrollments(
  pool: Pool,
  { page, pageSize, courseId }: ListEnrollmentsQuery,
): Promise<{ items: AdminEnrollment[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const whereClause = courseId ? 'WHERE e.course_id = $3' : '';
  const params = courseId ? [pageSize, offset, courseId] : [pageSize, offset];

  const { rows } = await pool.query(
    `SELECT e.id, e.status, e.enrolled_at, e.completed_at,
            u.id AS user_id, u.display_name AS user_name, u.email AS user_email,
            c.id AS course_id, c.title AS course_title, c.slug AS course_slug
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     JOIN courses c ON c.id = e.course_id
     ${whereClause}
     ORDER BY e.enrolled_at DESC
     LIMIT $1 OFFSET $2`,
    params,
  );

  const countParams = courseId ? [courseId] : [];
  const {
    rows: [{ count }],
  } = await pool.query<{ count: string }>(`SELECT count(*) FROM enrollments e ${courseId ? 'WHERE e.course_id = $1' : ''}`, countParams);

  return {
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      enrolledAt: row.enrolled_at,
      completedAt: row.completed_at,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseSlug: row.course_slug,
    })),
    total: Number(count),
  };
}

export interface AdminAnalytics {
  totalUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  certificatesIssued: number;
  averageQuizScore: number;
  aiMessagesSent: number;
  aiAverageLatencyMs: number;
  aiFeedbackUp: number;
  aiFeedbackDown: number;
}

async function countRows(pool: Pool, sql: string): Promise<number> {
  const {
    rows: [{ count }],
  } = await pool.query<{ count: string }>(sql);
  return Number(count);
}

export async function getAnalytics(pool: Pool): Promise<AdminAnalytics> {
  const [
    totalUsers,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    completedEnrollments,
    certificatesIssued,
    aiFeedbackUp,
    aiFeedbackDown,
    quizScoreRow,
    aiUsageRow,
  ] = await Promise.all([
    countRows(pool, 'SELECT count(*) FROM users'),
    countRows(pool, 'SELECT count(*) FROM courses'),
    countRows(pool, "SELECT count(*) FROM courses WHERE status = 'publish'"),
    countRows(pool, 'SELECT count(*) FROM enrollments'),
    countRows(pool, 'SELECT count(*) FROM enrollments WHERE completed_at IS NOT NULL'),
    countRows(pool, 'SELECT count(*) FROM certificates'),
    countRows(pool, "SELECT count(*) FROM ai_messages WHERE feedback_rating = 'up'"),
    countRows(pool, "SELECT count(*) FROM ai_messages WHERE feedback_rating = 'down'"),
    pool.query<{ avg_score: string }>('SELECT COALESCE(AVG(score), 0) AS avg_score FROM quiz_attempts WHERE score IS NOT NULL'),
    pool.query<{ total: string; avg_latency: string }>(
      "SELECT count(*) AS total, COALESCE(AVG(COALESCE(latency_ms, 0)), 0) AS avg_latency FROM ai_messages WHERE role = 'assistant'",
    ),
  ]);

  return {
    totalUsers,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    completedEnrollments,
    certificatesIssued,
    averageQuizScore: Math.round(Number(quizScoreRow.rows[0].avg_score) * 100) / 100,
    aiMessagesSent: Number(aiUsageRow.rows[0].total),
    aiAverageLatencyMs: Math.round(Number(aiUsageRow.rows[0].avg_latency)),
    aiFeedbackUp,
    aiFeedbackDown,
  };
}

export interface AdminReview {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  rating: number;
  reviewText: string | null;
  status: string;
  createdAt: string;
}

interface AdminReviewRow {
  id: string;
  user_id: string;
  user_name: string;
  course_id: string;
  course_title: string;
  rating: number;
  review_text: string | null;
  status: string;
  created_at: string;
}

function toAdminReview(row: AdminReviewRow): AdminReview {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    courseId: row.course_id,
    courseTitle: row.course_title,
    rating: row.rating,
    reviewText: row.review_text,
    status: row.status,
    createdAt: row.created_at,
  };
}

const ADMIN_REVIEW_SELECT = `
  SELECT r.id, r.user_id, u.display_name AS user_name, r.course_id, c.title AS course_title,
         r.rating, r.review_text, r.status, r.created_at
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  JOIN courses c ON c.id = r.course_id
`;

// Reviews default to 'pending' on creation (see infrastructure/migrations/0001_init.sql) —
// this is what actually lets a moderator flip them to 'approved' so listCourses' public
// GET /courses/:courseId/reviews (which only shows approved reviews) ever returns anything.
export async function listReviews(pool: Pool, { page, pageSize, status }: ListReviewsQuery): Promise<{ items: AdminReview[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const whereClause = status ? 'WHERE r.status = $3' : '';
  const params = status ? [pageSize, offset, status] : [pageSize, offset];

  const { rows } = await pool.query<AdminReviewRow>(
    `${ADMIN_REVIEW_SELECT} ${whereClause} ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
    params,
  );
  const countParams = status ? [status] : [];
  const {
    rows: [{ count }],
  } = await pool.query<{ count: string }>(`SELECT count(*) FROM reviews r ${status ? 'WHERE r.status = $1' : ''}`, countParams);

  return { items: rows.map(toAdminReview), total: Number(count) };
}

export async function moderateReview(pool: Pool, reviewId: string, status: 'approved' | 'rejected'): Promise<AdminReview> {
  const { rows } = await pool.query<{ id: string }>('UPDATE reviews SET status = $2 WHERE id = $1 RETURNING id', [
    reviewId,
    status,
  ]);
  if (rows.length === 0) {
    throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review could not be found');
  }
  const { rows: reviewRows } = await pool.query<AdminReviewRow>(`${ADMIN_REVIEW_SELECT} WHERE r.id = $1`, [reviewId]);
  return toAdminReview(reviewRows[0]);
}
