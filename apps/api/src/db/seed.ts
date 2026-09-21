import { pool } from './client.js';

async function seed() {
  await pool.query(`
    INSERT INTO users (email, display_name, role, status)
    VALUES
      ('admin@learnsphere.dev', 'Admin User', 'PLATFORM_ADMIN', 'active'),
      ('instructor@learnsphere.dev', 'Instructor User', 'INSTRUCTOR', 'active'),
      ('student@learnsphere.dev', 'Student User', 'STUDENT', 'active')
    ON CONFLICT (email) DO NOTHING
  `);

  const {
    rows: [course],
  } = await pool.query<{ id: string }>(
    `INSERT INTO courses (wp_course_id, slug, title, status, duration_minutes, difficulty)
     VALUES (1, 'intro-to-learnsphere', 'Intro to LearnSphere', 'publish', 60, 'beginner')
     ON CONFLICT (wp_course_id) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
  );

  const existingModule = await pool.query<{ id: string }>(
    'SELECT id FROM course_modules WHERE course_id = $1 AND wp_module_id = $2',
    [course.id, 1],
  );
  const moduleId =
    existingModule.rows[0]?.id ??
    (
      await pool.query<{ id: string }>(
        `INSERT INTO course_modules (course_id, wp_module_id, title, sort_order)
         VALUES ($1, 1, 'Getting Started', 0)
         RETURNING id`,
        [course.id],
      )
    ).rows[0].id;

  await pool.query(
    `INSERT INTO lessons (module_id, wp_lesson_id, slug, title, lesson_type, duration_minutes, sort_order, is_required)
     VALUES ($1, 1, 'welcome', 'Welcome', 'video', 5, 0, true)
     ON CONFLICT (wp_lesson_id) DO NOTHING`,
    [moduleId],
  );

  console.log('seed complete');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
