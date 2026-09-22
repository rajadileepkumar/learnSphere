'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { listAiConversations, type AIConversationSummary } from '../../lib/api';
import { ensureAccessToken } from '../../lib/session';
import styles from './ai.module.css';

// Shared Claude-style shell for /ai and /ai/[conversationId]: a history sidebar (only shown once
// there is history) plus whatever the route renders as the main panel. Re-fetches the list on every
// navigation within /ai so a freshly created conversation shows up immediately.
export default function AiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<AIConversationSummary[] | null>(null);

  useEffect(() => {
    ensureAccessToken()
      .then((token) => listAiConversations(token))
      .then(({ data }) => setConversations(data))
      .catch(() => router.replace('/login'));
  }, [pathname, router]);

  const hasHistory = conversations !== null && conversations.length > 0;

  return (
    <div className={styles.shell}>
      {hasHistory && (
        <aside className={styles.sidebar}>
          <Link href="/ai" className={styles.newChatButton}>
            + New chat
          </Link>
          <div className={styles.historyList}>
            {conversations!.map((c) => (
              <Link
                key={c.id}
                href={`/ai/${c.id}`}
                className={pathname === `/ai/${c.id}` ? styles.historyItemActive : styles.historyItem}
              >
                <div className={styles.historyTitle}>{c.title ?? 'New conversation'}</div>
                <div className={styles.historyMeta}>{c.courseTitle ?? 'General'}</div>
              </Link>
            ))}
          </div>
        </aside>
      )}
      <div className={styles.main}>{children}</div>
    </div>
  );
}
