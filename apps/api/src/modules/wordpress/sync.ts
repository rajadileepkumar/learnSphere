import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';
import { invalidateCache } from './cache.js';
import { fetchCourseByWpId, fetchLessonParentCourseId } from './queries.js';
import type { WPCourse } from './types.js';

export async function recordWebhookEvent(
  pool: Pool,
  id: string,
  source: string,
  eventName: string,
): Promise<boolean> {
  const existing = await pool.query('SELECT 1 FROM webhook_events WHERE id = $1', [id]);
  if (existing.rows.length > 0) {
    return false;
  }
  // ponytail: check-then-insert has a narrow race under truly concurrent duplicate
  // deliveries; ON CONFLICT DO NOTHING still stops it from throwing. Add a
  // SELECT ... FOR UPDATE/advisory lock if webhook senders ever fire duplicates concurrently.
  await pool.query(
    'INSERT INTO webhook_events (id, source, event_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [id, source, eventName],
  );
  return true;
}

async function upsertCourse(pool: Pool, course: WPCourse): Promise<string> {
  const {
    rows: [row],
  } = await pool.query<{ id: string }>(
    `INSERT INTO courses (wp_course_id, slug, title, status, thumbnail_url, duration_minutes, difficulty, published_at, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (wp_course_id) DO UPDATE SET
       slug = EXCLUDED.slug,
       title = EXCLUDED.title,
       status = EXCLUDED.status,
       thumbnail_url = EXCLUDED.thumbnail_url,
       duration_minutes = EXCLUDED.duration_minutes,
       difficulty = EXCLUDED.difficulty,
       published_at = EXCLUDED.published_at,
       synced_at = now()
     RETURNING id`,
    [
      course.wpId,
      course.slug,
      course.title,
      course.status,
      course.featuredImageUrl,
      course.durationMinutes,
      course.difficulty,
      course.publishedAt,
    ],
  );
  return row.id;
}

async function upsertModule(pool: Pool, courseId: string, module: WPCourse['modules'][number]): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM course_modules WHERE course_id = $1 AND wp_module_id = $2',
    [courseId, module.wpId],
  );
  if (existing.rows[0]) {
    await pool.query('UPDATE course_modules SET title = $1, sort_order = $2 WHERE id = $3', [
      module.title,
      module.order,
      existing.rows[0].id,
    ]);
    return existing.rows[0].id;
  }
  const {
    rows: [row],
  } = await pool.query<{ id: string }>(
    `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [courseId, module.wpId, module.title, module.order],
  );
  return row.id;
}

async function upsertLesson(pool: Pool, moduleId: string, lesson: WPCourse['modules'][number]['lessons'][number]) {
  await pool.query(
    `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, duration_minutes, sort_order, is_required)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (wp_lesson_id) DO UPDATE SET
       module_id = EXCLUDED.module_id,
       slug = EXCLUDED.slug,
       title = EXCLUDED.title,
       lesson_type = EXCLUDED.lesson_type,
       duration_minutes = EXCLUDED.duration_minutes,
       sort_order = EXCLUDED.sort_order,
       is_required = EXCLUDED.is_required`,
    [
      moduleId,
      lesson.wpId,
      lesson.slug,
      lesson.title,
      lesson.lessonType,
      lesson.durationMinutes,
      lesson.order,
      lesson.isRequired,
    ],
  );
}

export async function syncCourse(pool: Pool, wpCourseId: number): Promise<void> {
  const course = await fetchCourseByWpId(wpCourseId);
  if (!course) {
    throw new AppError(404, 'WORDPRESS_COURSE_NOT_FOUND', `No WordPress course found for id ${wpCourseId}`);
  }
  const courseId = await upsertCourse(pool, course);
  for (const module of course.modules) {
    const moduleId = await upsertModule(pool, courseId, module);
    for (const lesson of module.lessons) {
      await upsertLesson(pool, moduleId, lesson);
    }
  }
  invalidateCache('course:');
}

export async function markCourseUnpublished(pool: Pool, wpCourseId: number): Promise<void> {
  await pool.query(`UPDATE courses SET status = 'unpublished', synced_at = now() WHERE wp_course_id = $1`, [
    wpCourseId,
  ]);
  invalidateCache('course:');
}

export async function syncLesson(pool: Pool, wpLessonId: number): Promise<void> {
  const courseWpId = await fetchLessonParentCourseId(wpLessonId);
  if (!courseWpId) {
    throw new AppError(404, 'WORDPRESS_LESSON_NOT_FOUND', `No WordPress lesson found for id ${wpLessonId}`);
  }
  await syncCourse(pool, courseWpId);
}
