import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';
import type { ListCoursesQuery } from './schemas.js';

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  difficulty: string | null;
  publishedAt: string | null;
}

export interface CourseLesson {
  id: string;
  slug: string;
  title: string;
  lessonType: string;
  durationMinutes: number | null;
  order: number;
  isRequired: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  order: number;
  lessons: CourseLesson[];
}

export interface CourseDetail extends CourseSummary {
  modules: CourseModule[];
}

export async function listCourses(
  pool: Pool,
  { page, pageSize, sort }: ListCoursesQuery,
): Promise<{ items: CourseSummary[]; total: number }> {
  const orderBy = sort === 'popular' ? 'enrollment_count DESC, c.published_at DESC NULLS LAST' : 'c.published_at DESC NULLS LAST';
  const offset = (page - 1) * pageSize;

  const { rows } = await pool.query(
    `SELECT c.id, c.slug, c.title, c.thumbnail_url, c.duration_minutes, c.difficulty, c.published_at,
            COUNT(e.id)::int AS enrollment_count
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id
     WHERE c.status = 'publish'
     GROUP BY c.id, c.slug, c.title, c.thumbnail_url, c.duration_minutes, c.difficulty, c.published_at
     ORDER BY ${orderBy}
     LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );
  const {
    rows: [{ count }],
  } = await pool.query<{ count: string }>(`SELECT count(*) FROM courses WHERE status = 'publish'`);

  return {
    items: rows.map(toCourseSummary),
    total: Number(count),
  };
}

export async function getCourseBySlug(pool: Pool, slug: string): Promise<CourseDetail | null> {
  const { rows } = await pool.query(
    `SELECT id, slug, title, thumbnail_url, duration_minutes, difficulty, published_at
     FROM courses WHERE slug = $1 AND status = 'publish'`,
    [slug],
  );
  const course = rows[0];
  if (!course) return null;

  const { rows: curriculumRows } = await pool.query(
    `SELECT m.id AS module_id, m.title AS module_title, m.sort_order AS module_order,
            l.id AS lesson_id, l.slug AS lesson_slug, l.title AS lesson_title, l.lesson_type,
            l.duration_minutes AS lesson_duration_minutes, l.sort_order AS lesson_order, l.is_required
     FROM course_modules m
     LEFT JOIN lessons l ON l.module_id = m.id
     WHERE m.course_id = $1
     ORDER BY m.sort_order, l.sort_order`,
    [course.id],
  );

  const modules = new Map<string, CourseModule>();
  for (const row of curriculumRows) {
    let mod = modules.get(row.module_id);
    if (!mod) {
      mod = { id: row.module_id, title: row.module_title, order: row.module_order, lessons: [] };
      modules.set(row.module_id, mod);
    }
    if (row.lesson_id) {
      mod.lessons.push({
        id: row.lesson_id,
        slug: row.lesson_slug,
        title: row.lesson_title,
        lessonType: row.lesson_type,
        durationMinutes: row.lesson_duration_minutes,
        order: row.lesson_order,
        isRequired: row.is_required,
      });
    }
  }

  return { ...toCourseSummary(course), modules: [...modules.values()] };
}

export async function getCourseIdBySlug(pool: Pool, slug: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM courses WHERE slug = $1 AND status = 'publish'`,
    [slug],
  );
  if (!rows[0]) {
    throw new AppError(404, 'COURSE_NOT_FOUND', 'Course could not be found');
  }
  return rows[0].id;
}

export async function getEnrollment(
  pool: Pool,
  userId: string,
  courseId: string,
): Promise<{ id: string; status: string; enrolledAt: string; completedAt: string | null } | null> {
  const { rows } = await pool.query(
    'SELECT id, status, enrolled_at, completed_at FROM enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, status: row.status, enrolledAt: row.enrolled_at, completedAt: row.completed_at };
}

export async function enrollBySlug(
  pool: Pool,
  userId: string,
  slug: string,
): Promise<{ created: boolean; enrollment: { id: string; status: string; enrolledAt: string; completedAt: string | null } }> {
  const courseId = await getCourseIdBySlug(pool, slug);
  const existing = await getEnrollment(pool, userId, courseId);
  if (existing) {
    return { created: false, enrollment: existing };
  }
  // ON CONFLICT DO NOTHING guards a race against a near-simultaneous duplicate enroll;
  // re-reading afterwards sidesteps relying on its RETURNING row in that rare case.
  await pool.query(
    `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)
     ON CONFLICT (user_id, course_id) DO NOTHING`,
    [userId, courseId],
  );
  const enrollment = await getEnrollment(pool, userId, courseId);
  if (!enrollment) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create enrollment');
  }
  return { created: true, enrollment };
}

export async function requireEnrollmentBySlug(pool: Pool, userId: string, slug: string): Promise<string> {
  const courseId = await getCourseIdBySlug(pool, slug);
  const enrollment = await getEnrollment(pool, userId, courseId);
  if (!enrollment) {
    throw new AppError(403, 'NOT_ENROLLED', 'You are not enrolled in this course');
  }
  return courseId;
}

export async function getCourseProgress(
  pool: Pool,
  userId: string,
  slug: string,
): Promise<{
  overallPercent: number;
  lessons: { lessonId: string; title: string; status: string; progressPercent: number }[];
}> {
  const courseId = await requireEnrollmentBySlug(pool, userId, slug);

  const { rows } = await pool.query(
    `SELECT l.id AS lesson_id, l.title,
            COALESCE(lp.status, 'not_started') AS status,
            COALESCE(lp.progress_percent, 0) AS progress_percent
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
     WHERE m.course_id = $2
     ORDER BY m.sort_order, l.sort_order`,
    [userId, courseId],
  );

  const lessons = rows.map((row) => ({
    lessonId: row.lesson_id,
    title: row.title,
    status: row.status,
    progressPercent: Number(row.progress_percent),
  }));
  const overallPercent = lessons.length
    ? Math.round(lessons.reduce((sum, l) => sum + l.progressPercent, 0) / lessons.length)
    : 0;

  return { overallPercent, lessons };
}

function toCourseSummary(row: {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  difficulty: string | null;
  published_at: string | null;
}): CourseSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    durationMinutes: row.duration_minutes,
    difficulty: row.difficulty,
    publishedAt: row.published_at,
  };
}
