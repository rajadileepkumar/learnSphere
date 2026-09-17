import type { Pool } from 'pg';
import { hashPassword } from '../modules/auth/password.js';

// Dev-only convenience: gives the in-memory fallback DB (see client.ts) something to
// browse when running `npm run dev` without DATABASE_URL. Never used by tests, which
// build their own fixtures, and never runs against a real database.
export async function seedDemoData(pool: Pool): Promise<void> {
  const existing = await pool.query('SELECT 1 FROM courses LIMIT 1');
  if (existing.rows.length > 0) return;

  // Admin role is never client-assignable (see auth/service.ts), so dev needs a seeded
  // account to reach /admin at all without a real database to hand-edit.
  const adminPasswordHash = await hashPassword('adminpass123');
  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, role, status) VALUES ($1, $2, 'Demo Admin', 'PLATFORM_ADMIN', 'active')`,
    ['admin@learnsphere.dev', adminPasswordHash],
  );

  const {
    rows: [courseA],
  } = await pool.query<{ id: string }>(
    `INSERT INTO courses (wp_course_id, slug, title, status, duration_minutes, difficulty, published_at)
     VALUES (1, 'intro-to-learnsphere', 'Intro to LearnSphere', 'publish', 45, 'beginner', now())
     RETURNING id`,
  );
  const {
    rows: [moduleA],
  } = await pool.query<{ id: string }>(
    `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order) VALUES ($1, 1, 'Getting Started', 0) RETURNING id`,
    [courseA.id],
  );
  const { rows: lessonsA } = await pool.query<{ id: string; slug: string }>(
    `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, duration_minutes, sort_order, is_required)
     VALUES
       ($1, 1, 'welcome', 'Welcome to LearnSphere', 'video', 5, 0, true),
       ($1, 2, 'setting-goals', 'Setting Your Learning Goals', 'reading', 10, 1, true),
       ($1, 3, 'bonus-resources', 'Bonus Resources', 'reading', 8, 2, false)
     RETURNING id, slug`,
    [moduleA.id],
  );

  const welcomeLessonId = lessonsA.find((l) => l.slug === 'welcome')!.id;
  const {
    rows: [quiz],
  } = await pool.query<{ id: string }>(
    `INSERT INTO quizzes (lesson_id, passing_score, max_attempts) VALUES ($1, 70, 3) RETURNING id`,
    [welcomeLessonId],
  );
  const {
    rows: [q1],
  } = await pool.query<{ id: string }>(
    `INSERT INTO quiz_questions (quiz_id, question_text, question_type, sort_order)
     VALUES ($1, 'What does LearnSphere separate editorial content from?', 'single_choice', 0) RETURNING id`,
    [quiz.id],
  );
  await pool.query(
    `INSERT INTO quiz_options (question_id, option_text, is_correct)
     VALUES
       ($1, 'Student and application data', true),
       ($1, 'The database engine', false),
       ($1, 'The hosting provider', false)`,
    [q1.id],
  );
  const {
    rows: [q2],
  } = await pool.query<{ id: string }>(
    `INSERT INTO quiz_questions (quiz_id, question_text, question_type, sort_order)
     VALUES ($1, 'Where does student progress live?', 'single_choice', 1) RETURNING id`,
    [quiz.id],
  );
  await pool.query(
    `INSERT INTO quiz_options (question_id, option_text, is_correct)
     VALUES
       ($1, 'Neon PostgreSQL', true),
       ($1, 'WordPress', false)`,
    [q2.id],
  );

  const {
    rows: [courseB],
  } = await pool.query<{ id: string }>(
    `INSERT INTO courses (wp_course_id, slug, title, status, duration_minutes, difficulty, published_at)
     VALUES (2, 'advanced-react-patterns', 'Advanced React Patterns', 'publish', 180, 'advanced', now())
     RETURNING id`,
  );
  const {
    rows: [moduleB],
  } = await pool.query<{ id: string }>(
    `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order) VALUES ($1, 1, 'Composition Patterns', 0) RETURNING id`,
    [courseB.id],
  );
  await pool.query(
    `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, duration_minutes, sort_order, is_required)
     VALUES
       ($1, 4, 'compound-components', 'Compound Components', 'video', 20, 0, true),
       ($1, 5, 'render-props', 'Render Props', 'video', 18, 1, true)`,
    [moduleB.id],
  );
}
