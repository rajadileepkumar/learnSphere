import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { withRetry } from '../../lib/retry.js';

const REQUEST_TIMEOUT_MS = 8000;

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function postGraphQL(url: string, query: string, variables?: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new AppError(502, 'WORDPRESS_ERROR', `WordPress GraphQL responded with status ${res.status}`);
    }
    return res;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'WORDPRESS_UNREACHABLE', 'Could not reach the WordPress GraphQL endpoint');
  } finally {
    clearTimeout(timeout);
  }
}

export async function wpFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!env.WORDPRESS_GRAPHQL_URL) {
    throw new AppError(503, 'WORDPRESS_UNAVAILABLE', 'WordPress GraphQL endpoint is not configured');
  }

  // One retry for a transient network blip or a momentary 5xx from WordPress — each attempt
  // gets its own fresh timeout, so this is a GraphQL read and safe to repeat.
  const res = await withRetry(() => postGraphQL(env.WORDPRESS_GRAPHQL_URL!, query, variables), { retries: 1, delayMs: 300 });

  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new AppError(502, 'WORDPRESS_ERROR', body.errors[0].message);
  }
  if (!body.data) {
    throw new AppError(502, 'WORDPRESS_ERROR', 'WordPress GraphQL returned no data');
  }
  return body.data;
}
