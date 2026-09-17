import type { Pool } from 'pg';

export interface DashboardSummary {
  activeCourses: number;
  completedCourses: number;
  overallProgressPercent: number;
}

export interface DashboardCourse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  enrollmentStatus: string;
  enrolledAt: string;
  completedAt: string | null;
  progressPercent: number;
}

export interface DashboardActivityItem {
  lessonTitle: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  progressPercent: number;
  updatedAt: string;
}

export async function getSummary(pool: Pool, userId: string): Promise<DashboardSummary> {
  const {
    rows: [counts],
  } = await pool.query<{ active_count: string; completed_count: string }>(
    `SELECT
       SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) AS active_count,
       SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed_count
     FROM enrollments WHERE user_id = $1`,
    [userId],
  );
  // AVG() over a LEFT JOIN silently drops untouched lessons (they're NULL, and AVG
  // ignores NULLs) — COALESCE to 0 so an untouched lesson counts against the average
  // instead of vanishing from the denominator.
  const {
    rows: [{ avg_progress }],
  } = await pool.query<{ avg_progress: string }>(
    `SELECT COALESCE(AVG(COALESCE(lp.progress_percent, 0)), 0) AS avg_progress
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN course_modules m ON m.course_id = c.id
     JOIN lessons l ON l.module_id = m.id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
     WHERE e.user_id = $1`,
    [userId],
  );

  return {
    activeCourses: Number(counts?.active_count ?? 0),
    completedCourses: Number(counts?.completed_count ?? 0),
    overallProgressPercent: Math.round(Number(avg_progress)),
  };
}

export async function getMyCourses(pool: Pool, userId: string): Promise<DashboardCourse[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.slug, c.title, c.thumbnail_url,
            e.status AS enrollment_status, e.enrolled_at, e.completed_at,
            COALESCE(AVG(COALESCE(lp.progress_percent, 0)), 0) AS progress_percent
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN course_modules m ON m.course_id = c.id
     LEFT JOIN lessons l ON l.module_id = m.id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
     WHERE e.user_id = $1
     GROUP BY c.id, c.slug, c.title, c.thumbnail_url, e.status, e.enrolled_at, e.completed_at
     ORDER BY e.enrolled_at DESC`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    enrollmentStatus: row.enrollment_status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
    progressPercent: Math.round(Number(row.progress_percent)),
  }));
}

export async function getActivity(pool: Pool, userId: string): Promise<DashboardActivityItem[]> {
  const { rows } = await pool.query(
    `SELECT lp.updated_at, lp.status, lp.progress_percent, l.title AS lesson_title,
            c.slug AS course_slug, c.title AS course_title
     FROM lesson_progress lp
     JOIN lessons l ON l.id = lp.lesson_id
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE lp.user_id = $1
     ORDER BY lp.updated_at DESC
     LIMIT 20`,
    [userId],
  );

  return rows.map((row) => ({
    lessonTitle: row.lesson_title,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    status: row.status,
    progressPercent: Number(row.progress_percent),
    updatedAt: row.updated_at,
  }));
}
