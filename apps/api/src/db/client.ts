import pg from 'pg';
import { env } from '../config/env.js';

async function createPool(): Promise<pg.Pool> {
  if (env.DATABASE_URL) {
    return new pg.Pool({ connectionString: env.DATABASE_URL });
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not set');
  }
  // ponytail: no DATABASE_URL in dev -> fall back to a throwaway in-memory Postgres so
  // `npm run dev` works without a real database. Data resets on restart; set DATABASE_URL
  // (Neon) for anything that needs to persist.
  console.warn('[db] DATABASE_URL not set — using an in-memory dev database (data will not persist)');
  const { createDevMemoryPool } = await import('./dev-memory.js');
  return createDevMemoryPool();
}

export const pool = await createPool();
