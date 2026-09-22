'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureAccessToken()
      .then(async (t) => {
        setToken(t);
        const { data } = await getAiConversation(conversationId, t);
        setConversation(data);
      })
      .catch(() => router.replace('/login'));
  }, [conversationId, router]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation?.messages.length]);

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
    return <div className={styles.threadLoading}>{error ? <p className={styles.error}>{error}</p> : 'Loading...'}</div>;
  }

  return (
    <>
      <div className={styles.threadHeader}>
        <h1 className={styles.threadTitle}>{conversation.title ?? 'New conversation'}</h1>
        <p className={styles.cardMeta}>{conversation.courseTitle ?? 'General'}</p>
      </div>

      <div className={styles.threadArea}>
        <div className={styles.thread}>
          {conversation.messages.map((message) =>
            message.role === 'assistant' ? (
              <MessageBubble key={message.id} message={message} onFeedback={onFeedback} />
            ) : (
              // The question sits directly above its answer, so it's always clear what a given
              // answer is responding to — mirrors how Claude shows the prompt above its reply.
              <div key={message.id} className={styles.questionRow}>
                <div className={styles.questionLabel}>Asked</div>
                <MessageBubble message={message} onFeedback={onFeedback} />
              </div>
            ),
          )}
          <div ref={threadEndRef} />
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <form className={styles.composerBar} onSubmit={onSend}>
        <textarea
          className={styles.composerInput}
          placeholder="Ask a follow-up..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
        />
        <button className={styles.sendButton} type="submit" disabled={sending || !draft.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </>
  );
}

function MessageBubble({
  message,
  onFeedback,
}: {
  message: AIMessage;
  onFeedback: (id: string, rating: 'up' | 'down') => void;
}) {
  const isAssistant = message.role === 'assistant';
  return (
    <div className={isAssistant ? styles.assistantBubble : styles.userBubble}>
      <div className={styles.bubbleContent}>{message.content}</div>
      {message.sources.length > 0 && <div className={styles.sources}>Sources: {message.sources.map((s) => s.title).join(', ')}</div>}
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
