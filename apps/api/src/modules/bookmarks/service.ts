import type { Pool } from 'pg';
import { getCourseIdBySlug } from '../courses/service.js';

export interface BookmarkedCourse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  bookmarkedAt: string;
}

export async function addBookmark(pool: Pool, userId: string, slug: string): Promise<{ created: boolean; id: string }> {
  const courseId = await getCourseIdBySlug(pool, slug);
  const existing = await pool.query<{ id: string }>('SELECT id FROM bookmarks WHERE user_id = $1 AND course_id = $2', [
    userId,
    courseId,
  ]);
  if (existing.rows.length > 0) {
    return { created: false, id: existing.rows[0].id };
  }
  const {
    rows: [row],
  } = await pool.query<{ id: string }>('INSERT INTO bookmarks (user_id, course_id) VALUES ($1, $2) RETURNING id', [
    userId,
    courseId,
  ]);
  return { created: true, id: row.id };
}

export async function removeBookmark(pool: Pool, userId: string, slug: string): Promise<void> {
  const courseId = await getCourseIdBySlug(pool, slug);
  await pool.query('DELETE FROM bookmarks WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
}

export async function listBookmarks(pool: Pool, userId: string): Promise<BookmarkedCourse[]> {
  const { rows } = await pool.query(
    `SELECT b.created_at, c.id, c.slug, c.title, c.thumbnail_url
     FROM bookmarks b
     JOIN courses c ON c.id = b.course_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    bookmarkedAt: row.created_at,
  }));
}
