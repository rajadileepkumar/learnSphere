'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  getQuiz,
  getQuizResults,
  startQuizAttempt,
  submitQuizAttempt,
  type QuizAttempt,
  type QuizDetail,
  type QuizSubmitResult,
} from '../../../lib/api';
import { ensureAccessToken } from '../../../lib/session';
import styles from './quiz.module.css';

export default function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [pastResults, setPastResults] = useState<QuizAttempt[] | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startingAttempt, setStartingAttempt] = useState(false);

  const beginAttempt = useCallback(
    async (t: string) => {
      setError(null);
      setStartingAttempt(true);
      try {
        const { data } = await startQuizAttempt(quizId, t);
        setAttempt(data);
        setAnswers({});
        setResult(null);
        setLimitReached(false);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ATTEMPT_LIMIT_REACHED') {
          setLimitReached(true);
          const { data } = await getQuizResults(quizId, t);
          setPastResults(data);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to start quiz attempt');
        }
      } finally {
        setStartingAttempt(false);
      }
    },
    [quizId],
  );

  useEffect(() => {
    ensureAccessToken()
      .then(async (t) => {
        setToken(t);
        const { data } = await getQuiz(quizId, t);
        setQuiz(data);
        await beginAttempt(t);
      })
      .catch(() => router.replace('/login'));
  }, [quizId, router, beginAttempt]);

  function onSelect(questionId: string, optionId: string, questionType: string) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (questionType === 'single_choice') {
        return { ...prev, [questionId]: [optionId] };
      }
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  async function onSubmit() {
    if (!token || !quiz || !attempt) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = quiz.questions
        .map((q) => ({ questionId: q.id, optionIds: answers[q.id] ?? [] }))
        .filter((a) => a.optionIds.length > 0);
      const { data } = await submitQuizAttempt(quiz.id, attempt.id, token, payload);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  }

  if (!quiz || (startingAttempt && !limitReached)) {
    return (
      <main className={styles.page}>
        {error ? <p className={styles.error}>{error}</p> : <p>Loading...</p>}
      </main>
    );
  }

  if (limitReached) {
    return (
      <main className={styles.page}>
        <button className={styles.back} onClick={() => router.back()}>
          ← Back
        </button>
        <h1 className={styles.title}>Quiz</h1>
        <p className={styles.error}>You have used all attempts for this quiz.</p>
        {pastResults && pastResults.length > 0 && (
          <table className={styles.resultsTable}>
            <thead>
              <tr>
                <th>Attempt</th>
                <th>Score</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {pastResults.map((r) => (
                <tr key={r.id}>
                  <td>{r.attemptNumber}</td>
                  <td>{r.score ?? '—'}%</td>
                  <td>{r.passed === null ? 'In progress' : r.passed ? 'Passed' : 'Failed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    );
  }

  if (result) {
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    return (
      <main className={styles.page}>
        <button className={styles.back} onClick={() => router.back()}>
          ← Back
        </button>
        <h1 className={styles.title}>Quiz results</h1>
        <div className={result.passed ? styles.scoreBannerPass : styles.scoreBannerFail}>
          <div className={styles.scoreValue}>{result.score}%</div>
          <div>
            {result.passed ? 'Passed' : 'Not passed'} · {result.correctCount}/{result.totalQuestions} correct
          </div>
        </div>

        <div className={styles.reviewList}>
          {result.results.map((r) => {
            const question = byId.get(r.questionId);
            if (!question) return null;
            const selectedText = question.options
              .filter((o) => r.selectedOptionIds.includes(o.id))
              .map((o) => o.optionText)
              .join(', ');
            return (
              <div key={r.questionId} className={r.correct ? styles.reviewCardCorrect : styles.reviewCardIncorrect}>
                <div className={styles.reviewQuestion}>
                  {r.correct ? '✅' : '❌'} {question.questionText}
                </div>
                <div className={styles.meta}>Your answer: {selectedText || '(none)'}</div>
              </div>
            );
          })}
        </div>

        <button className={styles.submitButton} onClick={() => token && beginAttempt(token)} disabled={startingAttempt}>
          {startingAttempt ? 'Starting...' : 'Try again'}
        </button>
      </main>
    );
  }

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  return (
    <main className={styles.page}>
      <button className={styles.back} onClick={() => router.back()}>
        ← Back
      </button>
      <h1 className={styles.title}>Quiz</h1>
      <p className={styles.meta}>
        Attempt {attempt?.attemptNumber} · Passing score {quiz.passingScore}%
        {quiz.maxAttempts ? ` · ${quiz.maxAttempts} attempts allowed` : ''}
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.questionList}>
        {quiz.questions.map((question, index) => (
          <div key={question.id} className={styles.questionCard}>
            <div className={styles.questionText}>
              {index + 1}. {question.questionText}
            </div>
            <div className={styles.optionList}>
              {question.options.map((option) => {
                const selected = (answers[question.id] ?? []).includes(option.id);
                return (
                  <label key={option.id} className={styles.optionLabel}>
                    <input
                      type={question.questionType === 'single_choice' ? 'radio' : 'checkbox'}
                      name={question.id}
                      checked={selected}
                      onChange={() => onSelect(question.id, option.id, question.questionType)}
                    />
                    {option.optionText}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button className={styles.submitButton} onClick={onSubmit} disabled={!allAnswered || submitting}>
        {submitting ? 'Submitting...' : 'Submit quiz'}
      </button>
    </main>
  );
}
