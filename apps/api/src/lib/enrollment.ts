import type { Pool } from 'pg';
import { AppError } from './errors.js';

export async function assertEnrolled(pool: Pool, userId: string, courseId: string): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2', [
    userId,
    courseId,
  ]);
  if (rows.length === 0) {
    throw new AppError(403, 'NOT_ENROLLED', 'You are not enrolled in this course');
  }
}
