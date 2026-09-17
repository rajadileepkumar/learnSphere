import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from './password.js';

export interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
  status: string;
}

const PUBLIC_COLUMNS = 'id, email, display_name, role, avatar_url, status';

export async function registerUser(
  pool: Pool,
  input: { email: string; password: string; displayName: string },
): Promise<UserRecord> {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [input.email]);
  if (existing.rows.length > 0) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }
  const passwordHash = await hashPassword(input.password);
  // ponytail: registration always creates a STUDENT — other roles are admin-assigned, never client-supplied
  const { rows } = await pool.query<UserRecord>(
    `INSERT INTO users (email, password_hash, display_name, role, status)
     VALUES ($1, $2, $3, 'STUDENT', 'active')
     RETURNING ${PUBLIC_COLUMNS}`,
    [input.email, passwordHash, input.displayName],
  );
  return rows[0];
}

export async function verifyCredentials(pool: Pool, email: string, password: string): Promise<UserRecord> {
  const { rows } = await pool.query<UserRecord & { password_hash: string | null }>(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email],
  );
  const user = rows[0];
  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is not active');
  }
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    avatar_url: user.avatar_url,
    status: user.status,
  };
}

export async function findUserById(pool: Pool, id: string): Promise<UserRecord | null> {
  const { rows } = await pool.query<UserRecord>(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
