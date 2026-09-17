'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getAiConversation,
  postAiMessage,
  submitAiFeedback,
  type AIConversationDetail,
  type AIMessage,
} from '../../../lib/api';
import { ensureAccessToken } from '../../../lib/session';
import styles from '../ai.module.css';

export default function AiConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [conversation, setConversation] = useState<AIConversationDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureAccessToken()
      .then(async (t) => {
        setToken(t);
        const { data } = await getAiConversation(conversationId, t);
        setConversation(data);
      })
      .catch(() => router.replace('/login'));
  }, [conversationId, router]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!token || !draft.trim()) return;
    setError(null);
    setSending(true);
    const question = draft;
    setDraft('');
    try {
      const { data } = await postAiMessage(conversationId, token, question);
      setConversation((prev) => (prev ? { ...prev, messages: [...prev.messages, data.userMessage, data.assistantMessage] } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setDraft(question);
    } finally {
      setSending(false);
    }
  }

  async function onFeedback(messageId: string, rating: 'up' | 'down') {
    if (!token) return;
    try {
      await submitAiFeedback(messageId, token, rating);
      setConversation((prev) =>
        prev
          ? { ...prev, messages: prev.messages.map((m) => (m.id === messageId ? { ...m, feedbackRating: rating } : m)) }
          : prev,
      );
    } catch {
      // Feedback is a nice-to-have; a failed click just leaves the buttons active to retry.
    }
  }

  if (!conversation) {
    return (
      <main className={styles.page}>
        {error ? <p className={styles.error}>{error}</p> : <p className={styles.empty}>Loading...</p>}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/ai">
        ← All conversations
      </Link>
      <h1 className={styles.title}>{conversation.title ?? 'New conversation'}</h1>
      <p className={styles.cardMeta}>{conversation.courseTitle ?? 'General'}</p>

      <div className={styles.thread}>
        {conversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} onFeedback={onFeedback} />
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <form className={styles.composer} onSubmit={onSend}>
        <textarea
          className={styles.composerInput}
          placeholder="Ask the AI Tutor a question..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
        />
        <button className={styles.sendButton} type="submit" disabled={sending || !draft.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </main>
  );
}

function MessageBubble({ message, onFeedback }: { message: AIMessage; onFeedback: (id: string, rating: 'up' | 'down') => void }) {
  const isAssistant = message.role === 'assistant';
  return (
    <div className={isAssistant ? styles.assistantBubble : styles.userBubble}>
      <div className={styles.bubbleContent}>{message.content}</div>
      {message.sources.length > 0 && (
        <div className={styles.sources}>
          Sources: {message.sources.map((s) => s.title).join(', ')}
        </div>
      )}
      {isAssistant && (
        <div className={styles.feedbackRow}>
          <button
            className={message.feedbackRating === 'up' ? styles.feedbackActive : styles.feedbackButton}
            onClick={() => onFeedback(message.id, 'up')}
            aria-label="Helpful"
          >
            👍
          </button>
          <button
            className={message.feedbackRating === 'down' ? styles.feedbackActive : styles.feedbackButton}
            onClick={() => onFeedback(message.id, 'down')}
            aria-label="Not helpful"
          >
            👎
          </button>
        </div>
      )}
    </div>
  );
}
