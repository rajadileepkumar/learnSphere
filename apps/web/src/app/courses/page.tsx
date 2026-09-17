'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listCourses, type CourseSummary } from '../../lib/api';
import styles from './courses.module.css';

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCourses()
      .then(({ data }) => setCourses(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load courses'));
  }, []);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Courses</h1>
      {error && <p className={styles.error}>{error}</p>}
      {!error && courses === null && <p className={styles.empty}>Loading...</p>}
      {courses !== null && courses.length === 0 && <p className={styles.empty}>No courses published yet.</p>}
      {courses !== null && courses.length > 0 && (
        <div className={styles.grid}>
          {courses.map((course) => (
            <article key={course.id} className={styles.card}>
              {course.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnailUrl} alt="" className={styles.thumb} />
              ) : (
                <div className={styles.thumb} />
              )}
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{course.title}</h2>
                <p className={styles.meta}>
                  {course.difficulty ?? 'All levels'}
                  {course.durationMinutes ? ` · ${course.durationMinutes}m` : ''}
                </p>
                <Link className={styles.viewLink} href={`/courses/${course.slug}`}>
                  View course →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
