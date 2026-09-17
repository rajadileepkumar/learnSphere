import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginSchema, registerSchema } from './schemas.js';
import * as authService from './service.js';
import type { UserRecord } from './service.js';
import {
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './tokens.js';

function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    avatarUrl: user.avatar_url ?? undefined,
    status: user.status,
  };
}

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    // ponytail: 'lax' works for same-site localhost:3000 <-> :4000; switch to 'none'+secure if API and web ever live on different sites
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function authRoutes(pool: Pool): FastifyPluginAsync {
  return async (app) => {
    app.post('/register', async (req, reply) => {
      const input = registerSchema.parse(req.body);
      const user = await authService.registerUser(pool, input);
      const accessToken = signAccessToken({ sub: user.id, role: user.role });
      setRefreshCookie(reply, signRefreshToken(user.id));
      reply.status(201);
      return { data: { user: toPublicUser(user), accessToken }, meta: {} };
    });

    app.post('/login', async (req, reply) => {
      const input = loginSchema.parse(req.body);
      const user = await authService.verifyCredentials(pool, input.email, input.password);
      const accessToken = signAccessToken({ sub: user.id, role: user.role });
      setRefreshCookie(reply, signRefreshToken(user.id));
      return { data: { user: toPublicUser(user), accessToken }, meta: {} };
    });

    app.post('/refresh', async (req, reply) => {
      const token = req.cookies[REFRESH_COOKIE_NAME];
      if (!token) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Missing refresh token');
      }
      let payload: { sub: string };
      try {
        payload = verifyRefreshToken(token);
      } catch {
        throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired refresh token');
      }
      const user = await authService.findUserById(pool, payload.sub);
      if (!user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists');
      }
      const accessToken = signAccessToken({ sub: user.id, role: user.role });
      setRefreshCookie(reply, signRefreshToken(user.id));
      return { data: { accessToken }, meta: {} };
    });

    app.post('/logout', async (_req, reply) => {
      reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      return reply.status(204).send();
    });

    app.get('/me', { preHandler: authenticate }, async (req) => {
      const user = await authService.findUserById(pool, req.user!.id);
      if (!user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists');
      }
      return { data: { user: toPublicUser(user) }, meta: {} };
    });
  };
}
