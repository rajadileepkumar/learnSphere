// ponytail: zod as the one validation lib per 02-SRS.md — no separate config framework
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-me'),
  WORDPRESS_GRAPHQL_URL: z.string().optional(),
  WORDPRESS_WEBHOOK_SECRET: z.string().default('dev-webhook-secret-change-me'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  AI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
