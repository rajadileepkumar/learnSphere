import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataType, newDb } from 'pg-mem';
import type pg from 'pg';

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../infrastructure/migrations',
);

// ponytail: pg-mem stands in for a real Postgres in dev/test so this never needs a live DB
// connection. It is not wire-compatible with a real server — never reachable in production.
export function createDevMemoryPool(): pg.Pool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true,
  });
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const migrationSql = readFileSync(path.join(migrationsDir, file), 'utf8').replace(
      /CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/i,
      '',
    );
    db.public.none(migrationSql);
  }
  const { Pool } = db.adapters.createPg();
  return new Pool();
}
