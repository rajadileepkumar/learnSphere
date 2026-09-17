'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  completeLesson,
  createAiConversation,
  getLesson,
  getLessonNote,
  saveLessonNote,
  updateLessonProgress,
  type LessonDetail,
} from '../../../../../lib/api';
import { ensureAccessToken } from '../../../../../lib/session';
import styles from './lesson.module.css';

export default function LessonPlayerPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [status, setStatus] = useState('not_started');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const [note, setNote] = useState('');
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    ensureAccessToken()
      .then(async (token) => {
        setTokenReady(true);
        // A 403 here just means the student isn't enrolled in this lesson's course — leave
        // the note editor empty rather than treating it like an auth failure.
        try {
          const { data } = await getLessonNote(lessonId, token);
          setNote(data.content);
          setNoteSavedAt(data.updatedAt);
        } catch {
          // ignore
        }
      })
      .catch(() => router.replace('/login'));
  }, [lessonId, router]);

  useEffect(() => {
    getLesson(lessonId)
      .then(({ data }) => setLesson(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load lesson'));
  }, [lessonId]);

  async function onSaveProgress() {
    setError(null);
    setSaving(true);
    try {
      const token = await ensureAccessToken();
      const { data } = await updateLessonProgress(lessonId, token, { progressPercent: percent });
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save progress');
    } finally {
      setSaving(false);
    }
  }

  async function onComplete() {
    setError(null);
    setSaving(true);
    try {
      const token = await ensureAccessToken();
      const { data } = await completeLesson(lessonId, token);
      setStatus(data.status);
      setPercent(data.progressPercent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveNote() {
    setSavingNote(true);
    try {
      const token = await ensureAccessToken();
      const { data } = await saveLessonNote(lessonId, token, note);
      setNoteSavedAt(data.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  }

  async function onAskAiTutor() {
    if (!lesson) return;
    setStartingChat(true);
    try {
      const token = await ensureAccessToken();
      const { data } = await createAiConversation(token, lesson.courseId);
      router.push(`/ai/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start AI Tutor');
      setStartingChat(false);
    }
  }

  if (!tokenReady || !lesson) {
    return (
      <main className={styles.page}>
        {error ? <p className={styles.error}>{error}</p> : <p>Loading...</p>}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/courses/${slug}`}>
        ← Back to course
      </Link>
      <h1 className={styles.title}>{lesson.title}</h1>
      <p className={styles.meta}>
        {lesson.lessonType}
        {lesson.durationMinutes ? ` · ${lesson.durationMinutes}m` : ''}
        {lesson.isRequired ? ' · Required' : ' · Optional'}
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.content}>Lesson content is managed in WordPress and renders here once connected.</div>

      <button className={styles.aiTutorLink} onClick={onAskAiTutor} disabled={startingChat}>
        {startingChat ? 'Starting...' : '💬 Ask the AI Tutor about this lesson'}
      </button>

      {lesson.quizId && (
        <Link className={styles.quizLink} href={`/quizzes/${lesson.quizId}`}>
          📝 Take the quiz for this lesson
        </Link>
      )}

      <div className={styles.controls}>
        <div>
          Status: <span className={styles.status}>{status.replace('_', ' ')}</span>
        </div>
        <div className={styles.progressRow}>
          <input
            type="range"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
          <span>{percent}%</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.saveButton} onClick={onSaveProgress} disabled={saving}>
            Save progress
          </button>
          <button className={styles.completeButton} onClick={onComplete} disabled={saving || status === 'completed'}>
            {status === 'completed' ? 'Completed' : 'Mark complete'}
          </button>
        </div>
      </div>

      <div className={styles.notes}>
        <div className={styles.notesHeader}>
          <h2 className={styles.notesTitle}>My Notes</h2>
          {noteSavedAt && <span className={styles.meta}>Saved {new Date(noteSavedAt).toLocaleTimeString()}</span>}
        </div>
        <textarea
          className={styles.notesTextarea}
          placeholder="Jot down anything worth remembering from this lesson..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className={styles.saveButton} onClick={onSaveNote} disabled={savingNote}>
          {savingNote ? 'Saving...' : 'Save note'}
        </button>
      </div>
    </main>
  );
}
