import type { Pool } from 'pg';

export interface NoteSummary {
  lessonId: string;
  lessonTitle: string;
  courseSlug: string;
  courseTitle: string;
  content: string;
  updatedAt: string;
}

// Notes are saved per lesson (see modules/lessons), but the dashboard needs one place to see
// them all across every course — this is that read, blank saves excluded since an empty note
// isn't worth surfacing.
export async function listNotes(pool: Pool, userId: string): Promise<NoteSummary[]> {
  const { rows } = await pool.query(
    `SELECT n.lesson_id, l.title AS lesson_title, c.slug AS course_slug, c.title AS course_title, n.content, n.updated_at
     FROM lesson_notes n
     JOIN lessons l ON l.id = n.lesson_id
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE n.user_id = $1 AND n.content <> ''
     ORDER BY n.updated_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title,
    courseSlug: row.course_slug,
    courseTitle: row.course_title,
    content: row.content,
    updatedAt: row.updated_at,
  }));
}
