import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import { createUserRateLimiter } from '../../lib/rate-limit.js';
import * as aiService from './service.js';
import { createConversationSchema, feedbackSchema, postMessageSchema } from './schemas.js';

// specs/08-AI-SPEC.md calls for per-user rate limits on the AI Tutor specifically, since each
// message costs a real LLM call — 20 messages per 10 minutes is generous for normal studying.
const MESSAGE_RATE_LIMIT_MAX = 20;
const MESSAGE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export function aiRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.addHook('preHandler', authenticate);
    const limitMessageRate = createUserRateLimiter(MESSAGE_RATE_LIMIT_MAX, MESSAGE_RATE_LIMIT_WINDOW_MS);

    app.post('/conversations', async (req, reply) => {
      const input = createConversationSchema.parse(req.body);
      const conversation = await aiService.createConversation(pool, req.user!.id, input);
      reply.status(201);
      return { data: conversation, meta: {} };
    });

    app.get('/conversations', async (req) => {
      const conversations = await aiService.listConversations(pool, req.user!.id);
      return { data: conversations, meta: {} };
    });

    app.get('/conversations/:conversationId', async (req) => {
      const { conversationId } = req.params as { conversationId: string };
      const conversation = await aiService.getConversation(pool, req.user!.id, conversationId);
      return { data: conversation, meta: {} };
    });

    app.post('/conversations/:conversationId/messages', { preHandler: limitMessageRate }, async (req) => {
      const { conversationId } = req.params as { conversationId: string };
      const input = postMessageSchema.parse(req.body);
      const result = await aiService.postMessage(pool, req.user!.id, conversationId, input);
      return { data: result, meta: {} };
    });

    app.post('/messages/:messageId/feedback', async (req) => {
      const { messageId } = req.params as { messageId: string };
      const input = feedbackSchema.parse(req.body);
      const message = await aiService.submitFeedback(pool, req.user!.id, messageId, input.rating, input.comment);
      return { data: message, meta: {} };
    });
  };
}
