import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.WORDPRESS_GRAPHQL_URL = 'https://example.test/graphql';

const { buildApp } = await import('../app.js');
const { createTestPool } = await import('./helpers/test-db.js');

const rawCourse = {
  databaseId: 42,
  slug: 'ai-course',
  title: 'Biology Basics',
  status: 'publish',
  date: '2024-01-01T00:00:00',
  courseFields: {
    shortDescription: null,
    description: null,
    duration: null,
    difficulty: null,
    category: null,
    tags: [],
    featured: false,
    seoTitle: null,
    seoDescription: null,
    targetAudience: null,
    learningObjectives: [],
    prerequisites: [],
    featuredImage: null,
    instructor: null,
  },
  modules: {
    nodes: [
      {
        databaseId: 1,
        title: 'Plant Biology',
        moduleFields: { description: null, order: 0 },
        lessons: {
          nodes: [
            {
              databaseId: 101,
              slug: 'photosynthesis',
              title: 'Photosynthesis',
              lessonFields: {
                lessonType: 'reading',
                content: 'Photosynthesis is how plants convert sunlight into energy. This process does not work without chlorophyll.',
                videoUrl: null,
                duration: 10,
                objectives: [],
                order: 0,
                required: true,
                resources: [],
              },
            },
            {
              databaseId: 102,
              slug: 'recursion',
              title: 'Recursion',
              lessonFields: {
                lessonType: 'reading',
                content: 'Recursion is a programming technique where a function calls itself.',
                videoUrl: null,
                duration: 10,
                objectives: [],
                order: 1,
                required: true,
                resources: [],
              },
            },
          ],
        },
      },
    ],
  },
};

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { course: rawCourse } }) }),
);

describe('AI tutor routes', () => {
  let app: FastifyInstance;
  let pool: Pool;
  let accessToken: string;
  let courseId: string;
  let generalConversationId: string;
  let courseConversationId: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = buildApp(pool);

    const {
      rows: [course],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (42, 'ai-course', 'Biology Basics', 'publish') RETURNING id`,
    );
    courseId = course.id;

    const {
      rows: [otherCourse],
    } = await pool.query<{ id: string }>(
      `INSERT INTO courses (wp_course_id, slug, title, status) VALUES (43, 'other-ai-course', 'Other Course', 'publish') RETURNING id`,
    );

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'aistudent@test.com', password: 'password123', displayName: 'AI Student' },
    });
    accessToken = register.json().data.accessToken;

    await pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ((SELECT id FROM users WHERE email = $1), $2)', [
      'aistudent@test.com',
      courseId,
    ]);

    void otherCourse;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  function authed() {
    return { authorization: `Bearer ${accessToken}` };
  }

  it('requires auth for every AI route', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/v1/ai/conversations' });
    expect(create.statusCode).toBe(401);
    const list = await app.inject({ method: 'GET', url: '/api/v1/ai/conversations' });
    expect(list.statusCode).toBe(401);
  });

  it('rejects a conversation for a course the student is not enrolled in', async () => {
    const otherCourseRow = await pool.query<{ id: string }>("SELECT id FROM courses WHERE slug = 'other-ai-course'");
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: authed(),
      payload: { courseId: otherCourseRow.rows[0].id },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NOT_ENROLLED');
  });

  it('creates a general conversation with no course context', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/conversations', headers: authed(), payload: {} });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.courseId).toBeNull();
    generalConversationId = res.json().data.id;
  });

  it('creates a course-scoped conversation when enrolled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/conversations',
      headers: authed(),
      payload: { courseId },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.courseTitle).toBe('Biology Basics');
    courseConversationId = res.json().data.id;
  });

  it('lists the created conversations', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/conversations', headers: authed() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it('404s for an unknown conversation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/conversations/00000000-0000-0000-0000-000000000000',
      headers: authed(),
    });
    expect(res.statusCode).toBe(404);
  });

  it('answers with the mock provider and no sources when there is no course context', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${generalConversationId}/messages`,
      headers: authed(),
      payload: { content: 'What is a variable?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.userMessage.content).toBe('What is a variable?');
    expect(body.assistantMessage.model).toBe('mock-tutor-v1');
    expect(body.assistantMessage.sources).toHaveLength(0);
  });

  it('grounds the answer in matching course content and returns sources', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/conversations/${courseConversationId}/messages`,
      headers: authed(),
      payload: { content: 'How does photosynthesis work?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.assistantMessage.sources).toHaveLength(1);
    expect(body.assistantMessage.sources[0].title).toBe('Photosynthesis');
    expect(body.assistantMessage.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('auto-titles the conversation from the first question and reflects it in the list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/conversations', headers: authed() });
    const convo = res.json().data.find((c: { id: string }) => c.id === courseConversationId);
    expect(convo.title).toBe('How does photosynthesis work?');
  });

  it('returns the full conversation with messages and sources', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/conversations/${courseConversationId}`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages[1].sources).toHaveLength(1);
  });

  let assistantMessageId: string;

  it('accepts feedback on an assistant message', async () => {
    const conversation = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/conversations/${courseConversationId}`,
      headers: authed(),
    });
    assistantMessageId = conversation.json().data.messages[1].id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/messages/${assistantMessageId}/feedback`,
      headers: authed(),
      payload: { rating: 'up', comment: 'Helpful!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.feedbackRating).toBe('up');
  });

  it('rejects feedback from a user who does not own the conversation', async () => {
    const otherRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'otheraistudent@test.com', password: 'password123', displayName: 'Other' },
    });
    const otherToken = otherRegister.json().data.accessToken;
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/messages/${assistantMessageId}/feedback`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { rating: 'down' },
    });
    expect(res.statusCode).toBe(404);
  });
});
