'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createAiConversation, listAiConversations, type AIConversationSummary } from '../../lib/api';
import { ensureAccessToken } from '../../lib/session';
import styles from './ai.module.css';

export default function AiConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<AIConversationSummary[] | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    ensureAccessToken()
      .then((token) => listAiConversations(token))
      .then(({ data }) => setConversations(data))
      .catch(() => router.replace('/login'));
  }, [router]);

  async function onNewConversation() {
    setStarting(true);
    try {
      const token = await ensureAccessToken();
      const { data } = await createAiConversation(token);
      router.push(`/ai/${data.id}`);
    } catch {
      router.replace('/login');
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI Tutor</h1>
        <button className={styles.newButton} onClick={onNewConversation} disabled={starting}>
          {starting ? 'Starting...' : 'New conversation'}
        </button>
      </div>

      {conversations === null && <p className={styles.empty}>Loading...</p>}
      {conversations !== null && conversations.length === 0 && (
        <p className={styles.empty}>No conversations yet. Start one, or ask a question from a lesson page.</p>
      )}
      {conversations !== null && conversations.length > 0 && (
        <div className={styles.list}>
          {conversations.map((c) => (
            <Link key={c.id} href={`/ai/${c.id}`} className={styles.card}>
              <div className={styles.cardTitle}>{c.title ?? 'New conversation'}</div>
              <div className={styles.cardMeta}>
                {c.courseTitle ?? 'General'} · {new Date(c.updatedAt).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
