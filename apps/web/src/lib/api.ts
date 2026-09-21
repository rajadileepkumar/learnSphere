const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? 'Request failed');
  }
  return body as T;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
}

export function register(input: { email: string; password: string; displayName: string }) {
  return request<{ data: { user: AuthUser; accessToken: string } }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return request<{ data: { user: AuthUser; accessToken: string } }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function refresh() {
  return request<{ data: { accessToken: string } }>('/api/v1/auth/refresh', { method: 'POST' });
}

export function logout() {
  return request<null>('/api/v1/auth/logout', { method: 'POST' });
}

export function me(accessToken: string) {
  return request<{ data: { user: AuthUser } }>('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  difficulty: string | null;
  publishedAt: string | null;
}

export interface CourseLesson {
  id: string;
  slug: string;
  title: string;
  lessonType: string;
  durationMinutes: number | null;
  order: number;
  isRequired: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  order: number;
  lessons: CourseLesson[];
}

export interface CourseDetail extends CourseSummary {
  modules: CourseModule[];
}

export interface LessonDetail {
  id: string;
  slug: string;
  title: string;
  lessonType: string;
  durationMinutes: number | null;
  order: number;
  isRequired: boolean;
  courseId: string;
  courseSlug: string;
  quizId: string | null;
  content: {
    html: string | null;
    videoEmbedUrl: string | null;
    objectives: string[];
    resources: { title: string; url: string }[];
  } | null;
}

export interface LessonProgress {
  status: string;
  progressPercent: number;
  lastPositionSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface CourseProgress {
  overallPercent: number;
  lessons: { lessonId: string; title: string; status: string; progressPercent: number }[];
}

export interface Enrollment {
  id: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
}

export interface DashboardSummary {
  activeCourses: number;
  completedCourses: number;
  overallProgressPercent: number;
}

export interface DashboardCourse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  enrollmentStatus: string;
  enrolledAt: string;
  completedAt: string | null;
  progressPercent: number;
}

export interface DashboardActivityItem {
  lessonTitle: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  progressPercent: number;
  updatedAt: string;
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export function listCourses(params: { page?: number; sort?: 'newest' | 'popular' } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.sort) query.set('sort', params.sort);
  const qs = query.toString();
  return request<{ data: CourseSummary[]; meta: { page: number; pageSize: number; total: number } }>(
    `/api/v1/courses${qs ? `?${qs}` : ''}`,
  );
}

export function getCourse(slug: string) {
  return request<{ data: CourseDetail }>(`/api/v1/courses/${slug}`);
}

export function getCourseProgress(slug: string, accessToken: string) {
  return request<{ data: CourseProgress }>(`/api/v1/courses/${slug}/progress`, {
    headers: authHeaders(accessToken),
  });
}

export function enrollCourse(slug: string, accessToken: string) {
  return request<{ data: Enrollment }>(`/api/v1/courses/${slug}/enroll`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function getLesson(lessonId: string) {
  return request<{ data: LessonDetail }>(`/api/v1/lessons/${lessonId}`);
}

export function updateLessonProgress(
  lessonId: string,
  accessToken: string,
  input: { progressPercent?: number; lastPositionSeconds?: number },
) {
  return request<{ data: LessonProgress }>(`/api/v1/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function completeLesson(lessonId: string, accessToken: string) {
  return request<{ data: LessonProgress }>(`/api/v1/lessons/${lessonId}/complete`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export interface LessonNote {
  content: string;
  updatedAt: string | null;
}

export function getLessonNote(lessonId: string, accessToken: string) {
  return request<{ data: LessonNote }>(`/api/v1/lessons/${lessonId}/notes`, { headers: authHeaders(accessToken) });
}

export function saveLessonNote(lessonId: string, accessToken: string, content: string) {
  return request<{ data: LessonNote }>(`/api/v1/lessons/${lessonId}/notes`, {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ content }),
  });
}

export interface NoteSummary {
  lessonId: string;
  lessonTitle: string;
  courseSlug: string;
  courseTitle: string;
  content: string;
  updatedAt: string;
}

export function getNotes(accessToken: string) {
  return request<{ data: NoteSummary[] }>('/api/v1/notes', { headers: authHeaders(accessToken) });
}

export function getDashboardSummary(accessToken: string) {
  return request<{ data: DashboardSummary }>('/api/v1/dashboard/summary', { headers: authHeaders(accessToken) });
}

export function getDashboardMyCourses(accessToken: string) {
  return request<{ data: DashboardCourse[] }>('/api/v1/dashboard/my-courses', {
    headers: authHeaders(accessToken),
  });
}

export function getDashboardActivity(accessToken: string) {
  return request<{ data: DashboardActivityItem[] }>('/api/v1/dashboard/activity', {
    headers: authHeaders(accessToken),
  });
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

export function getCertificates(accessToken: string) {
  return request<{ data: Certificate[] }>('/api/v1/certificates', { headers: authHeaders(accessToken) });
}

export function getCertificate(certificateId: string, accessToken: string) {
  return request<{ data: Certificate }>(`/api/v1/certificates/${certificateId}`, {
    headers: authHeaders(accessToken),
  });
}

export interface CertificateVerification {
  certificateNumber: string;
  issuedAt: string;
  courseTitle: string;
  studentName: string;
}

// Public — no auth. Anyone with a code (e.g. an employer checking a printed certificate)
// can look it up.
export function verifyCertificate(verificationCode: string) {
  return request<{ data: CertificateVerification }>(`/api/v1/certificates/verify/${verificationCode}`);
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
  moduleCount: number;
  lessonCount: number;
  enrollmentCount: number;
}

export interface AdminEnrollment {
  id: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  certificatesIssued: number;
  averageQuizScore: number;
  aiMessagesSent: number;
  aiAverageLatencyMs: number;
  aiFeedbackUp: number;
  aiFeedbackDown: number;
}

export function getAdminUsers(accessToken: string) {
  return request<{ data: AdminUser[]; meta: { total: number } }>('/api/v1/admin/users', {
    headers: authHeaders(accessToken),
  });
}

export function getAdminCourses(accessToken: string) {
  return request<{ data: AdminCourse[]; meta: { total: number } }>('/api/v1/admin/courses', {
    headers: authHeaders(accessToken),
  });
}

export function getAdminEnrollments(accessToken: string) {
  return request<{ data: AdminEnrollment[]; meta: { total: number } }>('/api/v1/admin/enrollments', {
    headers: authHeaders(accessToken),
  });
}

export function getAdminAnalytics(accessToken: string) {
  return request<{ data: AdminAnalytics }>('/api/v1/admin/analytics', { headers: authHeaders(accessToken) });
}

export function revalidateContent(accessToken: string) {
  return request<{ data: { cleared: boolean } }>('/api/v1/admin/content/revalidate', {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export interface Bookmark {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  bookmarkedAt: string;
}

export function getBookmarks(accessToken: string) {
  return request<{ data: Bookmark[] }>('/api/v1/bookmarks', { headers: authHeaders(accessToken) });
}

export function addBookmark(slug: string, accessToken: string) {
  return request<{ data: { id: string; bookmarked: boolean } }>(`/api/v1/courses/${slug}/bookmark`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function removeBookmark(slug: string, accessToken: string) {
  return request<null>(`/api/v1/courses/${slug}/bookmark`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  rating: number;
  reviewText: string | null;
  status: string;
  createdAt: string;
}

export function getCourseReviews(slug: string, accessToken?: string) {
  return request<{ data: Review[] }>(`/api/v1/courses/${slug}/reviews`, {
    headers: accessToken ? authHeaders(accessToken) : {},
  });
}

export function createReview(slug: string, accessToken: string, input: { rating: number; reviewText?: string }) {
  return request<{ data: Review }>(`/api/v1/courses/${slug}/reviews`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function updateReview(reviewId: string, accessToken: string, input: { rating?: number; reviewText?: string }) {
  return request<{ data: Review }>(`/api/v1/reviews/${reviewId}`, {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export function deleteReview(reviewId: string, accessToken: string) {
  return request<null>(`/api/v1/reviews/${reviewId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
}

export interface AIConversationSummary {
  id: string;
  courseId: string | null;
  courseTitle: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessageSource {
  title: string;
  url: string | null;
  relevanceScore: number;
}

export interface AIMessage {
  id: string;
  role: string;
  content: string;
  model: string | null;
  latencyMs: number | null;
  createdAt: string;
  feedbackRating: string | null;
  sources: AIMessageSource[];
}

export interface AIConversationDetail extends AIConversationSummary {
  messages: AIMessage[];
}

export function listAiConversations(accessToken: string) {
  return request<{ data: AIConversationSummary[] }>('/api/v1/ai/conversations', { headers: authHeaders(accessToken) });
}

export function createAiConversation(accessToken: string, courseId?: string) {
  return request<{ data: AIConversationSummary }>('/api/v1/ai/conversations', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(courseId ? { courseId } : {}),
  });
}

export function getAiConversation(conversationId: string, accessToken: string) {
  return request<{ data: AIConversationDetail }>(`/api/v1/ai/conversations/${conversationId}`, {
    headers: authHeaders(accessToken),
  });
}

export function postAiMessage(conversationId: string, accessToken: string, content: string) {
  return request<{ data: { userMessage: AIMessage; assistantMessage: AIMessage } }>(
    `/api/v1/ai/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ content }),
    },
  );
}

export function submitAiFeedback(messageId: string, accessToken: string, rating: 'up' | 'down') {
  return request<{ data: AIMessage }>(`/api/v1/ai/messages/${messageId}/feedback`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ rating }),
  });
}

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

export interface QuizAttempt {
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

export function getQuiz(quizId: string, accessToken: string) {
  return request<{ data: QuizDetail }>(`/api/v1/quizzes/${quizId}`, { headers: authHeaders(accessToken) });
}

export function startQuizAttempt(quizId: string, accessToken: string) {
  return request<{ data: QuizAttempt }>(`/api/v1/quizzes/${quizId}/attempts`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function submitQuizAttempt(
  quizId: string,
  attemptId: string,
  accessToken: string,
  answers: { questionId: string; optionIds: string[] }[],
) {
  return request<{ data: QuizSubmitResult }>(`/api/v1/quizzes/${quizId}/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ answers }),
  });
}

export function getQuizResults(quizId: string, accessToken: string) {
  return request<{ data: QuizAttempt[] }>(`/api/v1/quizzes/${quizId}/results`, { headers: authHeaders(accessToken) });
}

export interface AdminReview {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  rating: number;
  reviewText: string | null;
  status: string;
  createdAt: string;
}

export function getAdminReviews(accessToken: string, status?: string) {
  const qs = status ? `?status=${status}` : '';
  return request<{ data: AdminReview[]; meta: { total: number } }>(`/api/v1/admin/reviews${qs}`, {
    headers: authHeaders(accessToken),
  });
}

export function moderateReview(reviewId: string, accessToken: string, status: 'approved' | 'rejected') {
  return request<{ data: AdminReview }>(`/api/v1/admin/reviews/${reviewId}/moderate`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ status }),
  });
}
