import sanitizeHtml from 'sanitize-html';
import type { Pool } from 'pg';
import { assertEnrolled } from '../../lib/enrollment.js';
import { AppError } from '../../lib/errors.js';
import { ensureCertificate } from '../certificates/service.js';
import { withCache } from '../wordpress/cache.js';
import { fetchLessonContent } from '../wordpress/queries.js';
import type { WPResource } from '../wordpress/types.js';
import type { LessonNoteInput, LessonProgressInput } from './schemas.js';

export interface LessonDetail {
  id: string;
  slug: string;
  title: string;
  lessonType: string;
  durationMinutes: number | null;
  order: number;
  isRequired: boolean;
  wpLessonId: number | null;
  courseId: string;
  courseSlug: string;
  quizId: string | null;
}

export interface LessonContent {
  html: string | null;
  videoEmbedUrl: string | null;
  objectives: string[];
  resources: WPResource[];
}

export interface LessonWithContent extends LessonDetail {
  content: LessonContent | null;
}

export interface LessonProgressResult {
  status: string;
  progressPercent: number;
  lastPositionSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

function toLessonProgressResult(row: {
  status: string;
  progress_percent: string | number;
  last_position_seconds?: number | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}): LessonProgressResult {
  return {
    status: row.status,
    progressPercent: Number(row.progress_percent),
    lastPositionSeconds: row.last_position_seconds ?? null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

async function getLessonContext(pool: Pool, lessonId: string): Promise<LessonDetail> {
  const { rows } = await pool.query(
    `SELECT l.id, l.slug, l.title, l.lesson_type, l.duration_minutes, l.sort_order, l.is_required, l.wp_lesson_id,
            c.id AS course_id, c.slug AS course_slug, q.id AS quiz_id
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     LEFT JOIN quizzes q ON q.lesson_id = l.id
     WHERE l.id = $1`,
    [lessonId],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, 'LESSON_NOT_FOUND', 'Lesson could not be found');
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    lessonType: row.lesson_type,
    durationMinutes: row.duration_minutes,
    order: row.sort_order,
    isRequired: row.is_required,
    wpLessonId: row.wp_lesson_id,
    courseId: row.course_id,
    courseSlug: row.course_slug,
    quizId: row.quiz_id,
  };
}

// Only YouTube is embedded, built from the parsed video id, so editor-supplied URLs can't inject arbitrary frames.
function toEmbedUrl(url: string | null): string | null {
  const id = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)?.[1];
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

// Lesson body lives in WordPress. A WordPress outage must not break the lesson page, so failures degrade to null.
async function loadContent(wpLessonId: number | null): Promise<LessonContent | null> {
  if (!wpLessonId) return null;
  try {
    const wp = await withCache(`course:lesson:${wpLessonId}`, 60_000, () => fetchLessonContent(wpLessonId));
    if (!wp) return null;
    return {
      html: wp.html ? sanitizeHtml(wp.html) : null,
      videoEmbedUrl: toEmbedUrl(wp.videoUrl),
      objectives: wp.objectives,
      resources: wp.resources.filter((r) => /^https?:\/\//.test(r.url)),
    };
  } catch {
    return null;
  }
}

export async function getLesson(pool: Pool, lessonId: string): Promise<LessonWithContent> {
  const lesson = await getLessonContext(pool, lessonId);
  return { ...lesson, content: await loadContent(lesson.wpLessonId) };
}

export async function upsertLessonProgress(
  pool: Pool,
  userId: string,
  lessonId: string,
  input: LessonProgressInput,
): Promise<LessonProgressResult> {
  const lesson = await getLessonContext(pool, lessonId);
  await assertEnrolled(pool, userId, lesson.courseId);

  const progressPercent = input.progressPercent ?? 0;
  const status = progressPercent >= 100 ? 'completed' : progressPercent > 0 ? 'in_progress' : 'not_started';

  const { rows } = await pool.query(
    `INSERT INTO lesson_progress (user_id, lesson_id, status, progress_percent, last_position_seconds, started_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       status = CASE WHEN lesson_progress.status = 'completed' THEN lesson_progress.status ELSE EXCLUDED.status END,
       progress_percent = GREATEST(lesson_progress.progress_percent, EXCLUDED.progress_percent),
       last_position_seconds = COALESCE(EXCLUDED.last_position_seconds, lesson_progress.last_position_seconds),
       updated_at = now()
     RETURNING status, progress_percent, last_position_seconds, started_at, completed_at, updated_at`,
    [userId, lessonId, status, progressPercent, input.lastPositionSeconds ?? 0],
  );
  return toLessonProgressResult(rows[0]);
}

async function maybeCompleteCourse(pool: Pool, userId: string, courseId: string): Promise<void> {
  const {
    rows: [{ required_total, required_done }],
  } = await pool.query<{ required_total: string; required_done: string }>(
    `SELECT
       SUM(CASE WHEN l.is_required THEN 1 ELSE 0 END) AS required_total,
       SUM(CASE WHEN l.is_required AND lp.status = 'completed' THEN 1 ELSE 0 END) AS required_done
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
     WHERE m.course_id = $2`,
    [userId, courseId],
  );
  const total = Number(required_total ?? 0);
  if (total > 0 && total === Number(required_done ?? 0)) {
    const { rows } = await pool.query(
      'UPDATE enrollments SET completed_at = now() WHERE user_id = $1 AND course_id = $2 AND completed_at IS NULL RETURNING id',
      [userId, courseId],
    );
    if (rows.length > 0) {
      await ensureCertificate(pool, userId, courseId);
    }
  }
}

export async function completeLesson(pool: Pool, userId: string, lessonId: string): Promise<LessonProgressResult> {
  const lesson = await getLessonContext(pool, lessonId);
  await assertEnrolled(pool, userId, lesson.courseId);

  const { rows } = await pool.query(
    `INSERT INTO lesson_progress (user_id, lesson_id, status, progress_percent, started_at, completed_at, updated_at)
     VALUES ($1, $2, 'completed', 100, now(), now(), now())
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       status = 'completed',
       progress_percent = 100,
       started_at = COALESCE(lesson_progress.started_at, now()),
       completed_at = now(),
       updated_at = now()
     RETURNING status, progress_percent, started_at, completed_at, updated_at`,
    [userId, lessonId],
  );

  await maybeCompleteCourse(pool, userId, lesson.courseId);
  return toLessonProgressResult(rows[0]);
}

export interface LessonNote {
  content: string;
  updatedAt: string | null;
}

// Private notes are gated on enrollment, same as progress — a note only makes sense for a
// lesson the student is actually taking.
export async function getLessonNote(pool: Pool, userId: string, lessonId: string): Promise<LessonNote> {
  const lesson = await getLessonContext(pool, lessonId);
  await assertEnrolled(pool, userId, lesson.courseId);

  const { rows } = await pool.query<{ content: string; updated_at: string }>(
    'SELECT content, updated_at FROM lesson_notes WHERE user_id = $1 AND lesson_id = $2',
    [userId, lessonId],
  );
  return rows[0] ? { content: rows[0].content, updatedAt: rows[0].updated_at } : { content: '', updatedAt: null };
}

export async function upsertLessonNote(pool: Pool, userId: string, lessonId: string, input: LessonNoteInput): Promise<LessonNote> {
  const lesson = await getLessonContext(pool, lessonId);
  await assertEnrolled(pool, userId, lesson.courseId);

  const {
    rows: [row],
  } = await pool.query<{ content: string; updated_at: string }>(
    `INSERT INTO lesson_notes (user_id, lesson_id, content, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET content = EXCLUDED.content, updated_at = now()
     RETURNING content, updated_at`,
    [userId, lessonId, input.content],
  );
  return { content: row.content, updatedAt: row.updated_at };
}
