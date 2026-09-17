'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getBookmarks, type Bookmark } from '../../lib/api';
import { ensureAccessToken } from '../../lib/session';
import styles from '../courses/courses.module.css';

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);

  useEffect(() => {
    ensureAccessToken()
      .then((token) => getBookmarks(token))
      .then(({ data }) => setBookmarks(data))
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Bookmarks</h1>
      {bookmarks === null && <p className={styles.empty}>Loading...</p>}
      {bookmarks !== null && bookmarks.length === 0 && (
        <p className={styles.empty}>
          No bookmarks yet. <Link href="/courses">Browse the catalog</Link> and bookmark a course to save it for later.
        </p>
      )}
      {bookmarks !== null && bookmarks.length > 0 && (
        <div className={styles.grid}>
          {bookmarks.map((bookmark) => (
            <article key={bookmark.id} className={styles.card}>
              {bookmark.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bookmark.thumbnailUrl} alt="" className={styles.thumb} />
              ) : (
                <div className={styles.thumb} />
              )}
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{bookmark.title}</h2>
                <Link className={styles.viewLink} href={`/courses/${bookmark.slug}`}>
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
