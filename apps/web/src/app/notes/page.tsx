'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getNotes, type NoteSummary } from '../../lib/api';
import { ensureAccessToken } from '../../lib/session';
import styles from './notes.module.css';

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);

  useEffect(() => {
    ensureAccessToken()
      .then((token) => getNotes(token))
      .then(({ data }) => setNotes(data))
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Notes</h1>
        <Link href="/dashboard">Back to dashboard</Link>
      </div>

      {notes === null && <p className={styles.empty}>Loading...</p>}
      {notes !== null && notes.length === 0 && (
        <p className={styles.empty}>No notes yet. Open a lesson and jot something down to see it here.</p>
      )}
      {notes !== null && notes.length > 0 && (
        <div className={styles.list}>
          {notes.map((note) => (
            <Link
              key={note.lessonId}
              href={`/courses/${note.courseSlug}/lessons/${note.lessonId}`}
              className={styles.card}
            >
              <div className={styles.lessonTitle}>{note.lessonTitle}</div>
              <div className={styles.meta}>
                {note.courseTitle} · updated {new Date(note.updatedAt).toLocaleDateString()}
              </div>
              <p className={styles.preview}>{note.content}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
