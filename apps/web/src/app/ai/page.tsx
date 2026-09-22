'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createAiConversation, postAiMessage } from '../../lib/api';
import { ensureAccessToken } from '../../lib/session';
import styles from './ai.module.css';

export default function AiConversationsPage() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      const { data: conversation } = await createAiConversation(token);
      await postAiMessage(conversation.id, token, draft);
      router.push(`/ai/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start a conversation');
      setSending(false);
    }
  }

  return (
    <div className={styles.blankScreen}>
      <div className={styles.blankInner}>
        <h1 className={styles.blankTitle}>AI Tutor</h1>
        <p className={styles.blankSubtitle}>Ask anything about a course, a lesson, or your progress.</p>
        {error && <p className={styles.error}>{error}</p>}
        <form className={styles.composer} onSubmit={onSend}>
          <textarea
            className={styles.composerInput}
            placeholder="Ask the AI Tutor a question..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
            autoFocus
          />
          <button className={styles.sendButton} type="submit" disabled={sending || !draft.trim()}>
            {sending ? 'Starting...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
