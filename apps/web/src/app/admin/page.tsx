'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getAdminAnalytics,
  getAdminCourses,
  getAdminEnrollments,
  getAdminReviews,
  getAdminUsers,
  me,
  moderateReview,
  revalidateContent,
  type AdminAnalytics,
  type AdminCourse,
  type AdminEnrollment,
  type AdminReview,
  type AdminUser,
} from '../../lib/api';
import { ensureAccessToken } from '../../lib/session';
import styles from './admin.module.css';

const ADMIN_ROLES = ['CONTENT_ADMIN', 'PLATFORM_ADMIN'];

export default function AdminPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [pendingReviews, setPendingReviews] = useState<AdminReview[]>([]);
  const [revalidating, setRevalidating] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const accessToken = await ensureAccessToken();
        const meRes = await me(accessToken);
        if (!ADMIN_ROLES.includes(meRes.data.user.role)) {
          router.replace('/dashboard');
          return;
        }
        setToken(accessToken);
        const [analyticsRes, usersRes, coursesRes, enrollmentsRes, reviewsRes] = await Promise.all([
          getAdminAnalytics(accessToken),
          getAdminUsers(accessToken),
          getAdminCourses(accessToken),
          getAdminEnrollments(accessToken),
          getAdminReviews(accessToken, 'pending'),
        ]);
        setAnalytics(analyticsRes.data);
        setUsers(usersRes.data);
        setCourses(coursesRes.data);
        setEnrollments(enrollmentsRes.data);
        setPendingReviews(reviewsRes.data);
      } catch {
        router.replace('/login');
      }
    }
    void load();
  }, [router]);

  async function onRevalidate() {
    if (!token) return;
    setRevalidating(true);
    try {
      await revalidateContent(token);
    } finally {
      setRevalidating(false);
    }
  }

  async function onModerate(reviewId: string, status: 'approved' | 'rejected') {
    if (!token) return;
    setModeratingId(reviewId);
    try {
      await moderateReview(reviewId, token, status);
      setPendingReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } finally {
      setModeratingId(null);
    }
  }

  if (!analytics) {
    return (
      <main className={styles.wrap}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Admin Dashboard</h1>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{analytics.totalUsers}</div>
          <div className={styles.statLabel}>Users</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {analytics.publishedCourses}/{analytics.totalCourses}
          </div>
          <div className={styles.statLabel}>Published courses</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{analytics.totalEnrollments}</div>
          <div className={styles.statLabel}>Enrollments</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{analytics.completedEnrollments}</div>
          <div className={styles.statLabel}>Completions</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{analytics.certificatesIssued}</div>
          <div className={styles.statLabel}>Certificates issued</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{analytics.averageQuizScore}%</div>
          <div className={styles.statLabel}>Avg. quiz score</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{analytics.aiMessagesSent}</div>
          <div className={styles.statLabel}>AI messages sent</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{analytics.aiAverageLatencyMs}ms</div>
          <div className={styles.statLabel}>AI avg. latency</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {analytics.aiFeedbackUp}/{analytics.aiFeedbackDown}
          </div>
          <div className={styles.statLabel}>AI feedback (up/down)</div>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Content Status</h2>
          <button className={styles.button} onClick={onRevalidate} disabled={revalidating}>
            {revalidating ? 'Revalidating...' : 'Revalidate content cache'}
          </button>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Course</th>
              <th>Status</th>
              <th>Modules</th>
              <th>Lessons</th>
              <th>Enrollments</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>{course.title}</td>
                <td>{course.status}</td>
                <td>{course.moduleCount}</td>
                <td>{course.lessonCount}</td>
                <td>{course.enrollmentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reviews Moderation</h2>
        {pendingReviews.length === 0 ? (
          <p className={styles.empty}>No reviews awaiting moderation.</p>
        ) : (
          <div className={styles.reviewQueue}>
            {pendingReviews.map((review) => (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <strong>{review.courseTitle}</strong>
                  <span className={styles.meta}>
                    {review.userName} · {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </span>
                </div>
                {review.reviewText && <p className={styles.reviewText}>{review.reviewText}</p>}
                <div className={styles.reviewActions}>
                  <button
                    className={styles.approveButton}
                    onClick={() => onModerate(review.id, 'approved')}
                    disabled={moderatingId === review.id}
                  >
                    Approve
                  </button>
                  <button
                    className={styles.rejectButton}
                    onClick={() => onModerate(review.id, 'rejected')}
                    disabled={moderatingId === review.id}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Users</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.displayName}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Enrollments</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Course</th>
              <th>Enrolled</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td>{enrollment.userName}</td>
                <td>{enrollment.courseTitle}</td>
                <td>{new Date(enrollment.enrolledAt).toLocaleDateString()}</td>
                <td>{enrollment.completedAt ? new Date(enrollment.completedAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
