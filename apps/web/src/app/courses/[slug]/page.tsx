'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  addBookmark,
  createReview,
  deleteReview,
  enrollCourse,
  getBookmarks,
  getCourse,
  getCourseProgress,
  getCourseReviews,
  me,
  removeBookmark,
  updateReview,
  ApiError,
  type CourseDetail,
  type CourseProgress,
  type Review,
} from '../../../lib/api';
import { ensureAccessToken } from '../../../lib/session';
import styles from '../courses.module.css';

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    getCourse(slug)
      .then(({ data }) => setCourse(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load course'));

    getCourseReviews(slug)
      .then(({ data }) => setReviews(data))
      .catch(() => {});

    ensureAccessToken()
      .then(async (t) => {
        setToken(t);
        const [meRes, progressRes, bookmarksRes, reviewsRes] = await Promise.all([
          me(t).catch(() => null),
          getCourseProgress(slug, t).catch(() => null),
          getBookmarks(t).catch(() => null),
          getCourseReviews(slug, t).catch(() => null),
        ]);
        if (meRes) setUserId(meRes.data.user.id);
        if (progressRes) {
          setProgress(progressRes.data);
          setEnrolled(true);
        }
        if (bookmarksRes) setBookmarked(bookmarksRes.data.some((b) => b.slug === slug));
        if (reviewsRes) setReviews(reviewsRes.data);
      })
      .catch(() => {
        // Not logged in — page stays in its logged-out default state.
      });
  }, [slug]);

  async function onEnroll() {
    setError(null);
    setEnrolling(true);
    try {
      const t = await ensureAccessToken();
      await enrollCourse(slug, t);
      const { data } = await getCourseProgress(slug, t);
      setProgress(data);
      setEnrolled(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  }

  async function onToggleBookmark() {
    setBookmarking(true);
    try {
      const t = token ?? (await ensureAccessToken());
      setToken(t);
      if (bookmarked) {
        await removeBookmark(slug, t);
        setBookmarked(false);
      } else {
        await addBookmark(slug, t);
        setBookmarked(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
    } finally {
      setBookmarking(false);
    }
  }

  const myReview = reviews.find((r) => r.userId === userId) ?? null;
  const otherReviews = reviews.filter((r) => r.id !== myReview?.id);

  async function refreshReviews(t: string) {
    const { data } = await getCourseReviews(slug, t);
    setReviews(data);
  }

  async function onSubmitReview(e: FormEvent) {
    e.preventDefault();
    setReviewError(null);
    setSavingReview(true);
    try {
      const t = token ?? (await ensureAccessToken());
      setToken(t);
      if (myReview) {
        await updateReview(myReview.id, t, { rating: reviewRating, reviewText: reviewText || undefined });
      } else {
        await createReview(slug, t, { rating: reviewRating, reviewText: reviewText || undefined });
      }
      await refreshReviews(t);
      setReviewText('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSavingReview(false);
    }
  }

  async function onDeleteReview() {
    if (!myReview) return;
    setSavingReview(true);
    try {
      const t = token ?? (await ensureAccessToken());
      await deleteReview(myReview.id, t);
      await refreshReviews(t);
      setReviewRating(5);
      setReviewText('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to delete review');
    } finally {
      setSavingReview(false);
    }
  }

  function progressForLesson(lessonId: string) {
    return progress?.lessons.find((l) => l.lessonId === lessonId);
  }

  if (error && !course) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>{error}</p>
      </main>
    );
  }

  if (!course) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Loading...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.detailTitle}>{course.title}</h1>
          <p className={styles.meta}>
            {course.difficulty ?? 'All levels'}
            {course.durationMinutes ? ` · ${course.durationMinutes}m` : ''}
            {enrolled ? ` · ${progress?.overallPercent ?? 0}% complete` : ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.bookmarkButton} onClick={onToggleBookmark} disabled={bookmarking}>
            {bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
          </button>
          {enrolled ? (
            <span className={styles.enrolledBadge}>Enrolled</span>
          ) : (
            <button className={styles.enrollButton} onClick={onEnroll} disabled={enrolling}>
              {enrolling ? 'Enrolling...' : 'Enroll'}
            </button>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.moduleList}>
        {course.modules.map((mod) => (
          <div key={mod.id} className={styles.moduleCard}>
            <div className={styles.moduleTitle}>{mod.title}</div>
            {mod.lessons.map((lesson) => {
              const lessonProgress = progressForLesson(lesson.id);
              return (
                <div key={lesson.id} className={styles.lessonRow}>
                  {enrolled ? (
                    <Link href={`/courses/${slug}/lessons/${lesson.id}`}>{lesson.title}</Link>
                  ) : (
                    <span>{lesson.title}</span>
                  )}
                  <span className={styles.lessonStatus}>
                    {lessonProgress ? lessonProgress.status.replace('_', ' ') : lesson.isRequired ? 'required' : 'optional'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <section className={styles.reviewsSection}>
        <h2 className={styles.sectionTitle}>Reviews</h2>

        {otherReviews.length === 0 && !myReview && <p className={styles.empty}>No reviews yet.</p>}

        <div className={styles.reviewList}>
          {myReview && (
            <div className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <strong>Your review</strong>
                <span className={styles.meta}>
                  {'★'.repeat(myReview.rating)}
                  {'☆'.repeat(5 - myReview.rating)} · {myReview.status}
                </span>
              </div>
              {myReview.reviewText && <p>{myReview.reviewText}</p>}
            </div>
          )}
          {otherReviews.map((review) => (
            <div key={review.id} className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <strong>{review.userName}</strong>
                <span className={styles.meta}>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </span>
              </div>
              {review.reviewText && <p>{review.reviewText}</p>}
            </div>
          ))}
        </div>

        {enrolled && (
          <form className={styles.reviewForm} onSubmit={onSubmitReview}>
            <h3 className={styles.reviewFormTitle}>{myReview ? 'Edit your review' : 'Write a review'}</h3>
            {reviewError && <p className={styles.error}>{reviewError}</p>}
            <label className={styles.reviewLabel}>
              Rating
              <select
                className={styles.ratingSelect}
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              className={styles.reviewTextarea}
              placeholder="Share your thoughts (optional)"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <div className={styles.reviewFormActions}>
              <button type="submit" className={styles.enrollButton} disabled={savingReview}>
                {myReview ? 'Update review' : 'Submit review'}
              </button>
              {myReview && (
                <button type="button" className={styles.deleteReviewButton} onClick={onDeleteReview} disabled={savingReview}>
                  Delete
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
