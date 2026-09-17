'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  logout as apiLogout,
  getDashboardActivity,
  getDashboardMyCourses,
  getDashboardSummary,
  me,
  type AuthUser,
  type DashboardActivityItem,
  type DashboardCourse,
  type DashboardSummary,
} from '../../lib/api';
import { clearAccessToken, ensureAccessToken } from '../../lib/session';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [courses, setCourses] = useState<DashboardCourse[]>([]);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const token = await ensureAccessToken();
        const [meRes, summaryRes, coursesRes, activityRes] = await Promise.all([
          me(token),
          getDashboardSummary(token),
          getDashboardMyCourses(token),
          getDashboardActivity(token),
        ]);
        setUser(meRes.data.user);
        setSummary(summaryRes.data);
        setCourses(coursesRes.data);
        setActivity(activityRes.data);
      } catch {
        router.replace('/login');
      }
    }
    void load();
  }, [router]);

  async function onLogout() {
    await apiLogout().catch(() => {});
    clearAccessToken();
    router.replace('/login');
  }

  if (!user || !summary) {
    return (
      <main className={styles.wrap}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome, {user.displayName}</h1>
        <div className={styles.headerActions}>
          <Link href="/ai" className={styles.certificatesLink}>
            AI Tutor
          </Link>
          <Link href="/bookmarks" className={styles.certificatesLink}>
            Bookmarks
          </Link>
          <Link href="/notes" className={styles.certificatesLink}>
            Notes
          </Link>
          <Link href="/certificates" className={styles.certificatesLink}>
            My Certificates
          </Link>
          <button className={styles.logout} onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{summary.activeCourses}</div>
          <div className={styles.statLabel}>Active courses</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{summary.completedCourses}</div>
          <div className={styles.statLabel}>Completed</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{summary.overallProgressPercent}%</div>
          <div className={styles.statLabel}>Overall progress</div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>My Courses</h2>
      {courses.length === 0 ? (
        <p className={styles.empty}>
          No courses yet. <Link href="/courses">Browse the catalog</Link>.
        </p>
      ) : (
        <div className={styles.courseList}>
          {courses.map((course) => (
            <div key={course.id} className={styles.courseRow}>
              <div>
                <Link href={`/courses/${course.slug}`}>{course.title}</Link>
                <div className={styles.courseMeta}>
                  {course.completedAt ? 'Completed' : `${course.progressPercent}% complete`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className={styles.sectionTitle}>Recent Activity</h2>
      {activity.length === 0 ? (
        <p className={styles.empty}>No activity yet.</p>
      ) : (
        <div className={styles.activityList}>
          {activity.map((item, i) => (
            <div key={i} className={styles.activityItem}>
              <strong>{item.lessonTitle}</strong> in {item.courseTitle} — {item.status.replace('_', ' ')} (
              {item.progressPercent}%)
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
