import type { Pool } from 'pg';
import { assertEnrolled } from '../../lib/enrollment.js';
import { AppError } from '../../lib/errors.js';
import type { SubmitAttemptInput } from './schemas.js';

export interface QuizOption {
  id: string;
  optionText: string;
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: string;
  order: number;
  options: QuizOption[];
}

export interface QuizDetail {
  id: string;
  passingScore: number;
  maxAttempts: number | null;
  questions: QuizQuestion[];
}

export interface QuizAttemptSummary {
  id: string;
  attemptNumber: number;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
}

export interface QuizSubmitResult {
  attemptId: string;
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  results: { questionId: string; correct: boolean; selectedOptionIds: string[] }[];
}

interface QuizContext {
  id: string;
  passingScore: number;
  maxAttempts: number | null;
  courseId: string;
}

async function getQuizContext(pool: Pool, quizId: string): Promise<QuizContext> {
  const { rows } = await pool.query(
    `SELECT q.id, q.passing_score, q.max_attempts, c.id AS course_id
     FROM quizzes q
     JOIN lessons l ON l.id = q.lesson_id
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE q.id = $1`,
    [quizId],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, 'QUIZ_NOT_FOUND', 'Quiz could not be found');
  }
  return {
    id: row.id,
    passingScore: Number(row.passing_score),
    maxAttempts: row.max_attempts,
    courseId: row.course_id,
  };
}

async function getQuestionsWithOptions(
  pool: Pool,
  quizId: string,
): Promise<{ id: string; questionText: string; questionType: string; order: number; options: (QuizOption & { isCorrect: boolean })[] }[]> {
  const { rows: questionRows } = await pool.query(
    'SELECT id, question_text, question_type, sort_order FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order',
    [quizId],
  );
  if (questionRows.length === 0) return [];

  const questionIds = questionRows.map((q) => q.id);
  // IN (...) rather than = ANY($1) — the array form doesn't bind correctly in the
  // pg-mem test double, and a plain IN list works identically against real Postgres.
  const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: optionRows } = await pool.query(
    `SELECT id, question_id, option_text, is_correct FROM quiz_options WHERE question_id IN (${placeholders})`,
    questionIds,
  );

  return questionRows.map((q) => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    order: q.sort_order,
    options: optionRows
      .filter((o) => o.question_id === q.id)
      .map((o) => ({ id: o.id, optionText: o.option_text, isCorrect: o.is_correct })),
  }));
}

export async function getQuizForStudent(pool: Pool, userId: string, quizId: string): Promise<QuizDetail> {
  const quiz = await getQuizContext(pool, quizId);
  await assertEnrolled(pool, userId, quiz.courseId);
  const questions = await getQuestionsWithOptions(pool, quizId);

  return {
    id: quiz.id,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    questions: questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      order: q.order,
      options: q.options.map((o) => ({ id: o.id, optionText: o.optionText })),
    })),
  };
}

export async function createAttempt(
  pool: Pool,
  userId: string,
  quizId: string,
): Promise<{ created: boolean; attempt: QuizAttemptSummary }> {
  const quiz = await getQuizContext(pool, quizId);
  await assertEnrolled(pool, userId, quiz.courseId);

  const open = await pool.query(
    `SELECT id, attempt_number, score, passed, started_at, submitted_at
     FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND submitted_at IS NULL
     ORDER BY attempt_number DESC LIMIT 1`,
    [quizId, userId],
  );
  if (open.rows[0]) {
    return { created: false, attempt: toAttemptSummary(open.rows[0]) };
  }

  const {
    rows: [{ count }],
  } = await pool.query<{ count: string }>(
    'SELECT count(*) FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2',
    [quizId, userId],
  );
  const attemptsUsed = Number(count);
  if (quiz.maxAttempts !== null && attemptsUsed >= quiz.maxAttempts) {
    throw new AppError(403, 'ATTEMPT_LIMIT_REACHED', 'You have used all attempts for this quiz');
  }

  const { rows } = await pool.query(
    `INSERT INTO quiz_attempts (quiz_id, user_id, attempt_number, started_at)
     VALUES ($1, $2, $3, now())
     RETURNING id, attempt_number, score, passed, started_at, submitted_at`,
    [quizId, userId, attemptsUsed + 1],
  );
  return { created: true, attempt: toAttemptSummary(rows[0]) };
}

export async function submitAttempt(
  pool: Pool,
  userId: string,
  quizId: string,
  attemptId: string,
  input: SubmitAttemptInput,
): Promise<QuizSubmitResult> {
  const quiz = await getQuizContext(pool, quizId);
  await assertEnrolled(pool, userId, quiz.courseId);

  const { rows: attemptRows } = await pool.query(
    'SELECT id, submitted_at FROM quiz_attempts WHERE id = $1 AND quiz_id = $2 AND user_id = $3',
    [attemptId, quizId, userId],
  );
  const attempt = attemptRows[0];
  if (!attempt) {
    throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt could not be found');
  }
  if (attempt.submitted_at) {
    throw new AppError(409, 'ALREADY_SUBMITTED', 'This attempt has already been submitted');
  }

  const questions = await getQuestionsWithOptions(pool, quizId);
  const questionIds = new Set(questions.map((q) => q.id));

  const answerByQuestion = new Map<string, Set<string>>();
  for (const answer of input.answers) {
    if (!questionIds.has(answer.questionId)) {
      throw new AppError(400, 'INVALID_ANSWER', 'Answer references a question that is not part of this quiz');
    }
    const question = questions.find((q) => q.id === answer.questionId)!;
    const validOptionIds = new Set(question.options.map((o) => o.id));
    for (const optionId of answer.optionIds) {
      if (!validOptionIds.has(optionId)) {
        throw new AppError(400, 'INVALID_ANSWER', 'Answer references an option that does not belong to the question');
      }
    }
    answerByQuestion.set(answer.questionId, new Set(answer.optionIds));
  }

  let correctCount = 0;
  const results = questions.map((q) => {
    const correctOptionIds = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    const selected = answerByQuestion.get(q.id) ?? new Set<string>();
    const correct = setsEqual(correctOptionIds, selected);
    if (correct) correctCount += 1;
    return { questionId: q.id, correct, selectedOptionIds: [...selected] };
  });

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 10000) / 100 : 0;
  const passed = score >= quiz.passingScore;

  await pool.query(
    'UPDATE quiz_attempts SET score = $1, passed = $2, submitted_at = now() WHERE id = $3',
    [score, passed, attemptId],
  );

  return { attemptId, score, passed, correctCount, totalQuestions, results };
}

export async function getResults(pool: Pool, userId: string, quizId: string): Promise<QuizAttemptSummary[]> {
  const quiz = await getQuizContext(pool, quizId);
  await assertEnrolled(pool, userId, quiz.courseId);

  const { rows } = await pool.query(
    `SELECT id, attempt_number, score, passed, started_at, submitted_at
     FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2
     ORDER BY attempt_number`,
    [quizId, userId],
  );
  return rows.map(toAttemptSummary);
}

function toAttemptSummary(row: {
  id: string;
  attempt_number: number;
  score: string | number | null;
  passed: boolean | null;
  started_at: string;
  submitted_at: string | null;
}): QuizAttemptSummary {
  return {
    id: row.id,
    attemptNumber: row.attempt_number,
    score: row.score === null ? null : Number(row.score),
    passed: row.passed,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
  };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
