import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from '../../lib/errors.js';

export interface CertificateSummary {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

export interface CertificateVerification {
  certificateNumber: string;
  issuedAt: string;
  courseTitle: string;
  studentName: string;
}

function generateCertificateNumber(): string {
  return `LS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function generateVerificationCode(): string {
  return crypto.randomBytes(12).toString('hex');
}

interface CertificateRow {
  id: string;
  certificate_number: string;
  verification_code: string;
  issued_at: string;
  course_id: string;
  title: string;
  slug: string;
}

function toCertificateSummary(row: CertificateRow): CertificateSummary {
  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    verificationCode: row.verification_code,
    issuedAt: row.issued_at,
    courseId: row.course_id,
    courseTitle: row.title,
    courseSlug: row.slug,
  };
}

// Called once a course completion is recorded; safe to call repeatedly for the same
// user+course since it checks for an existing certificate first (no re-completion flow exists).
export async function ensureCertificate(pool: Pool, userId: string, courseId: string): Promise<void> {
  const existing = await pool.query('SELECT 1 FROM certificates WHERE user_id = $1 AND course_id = $2', [
    userId,
    courseId,
  ]);
  if (existing.rows.length > 0) return;

  await pool.query(
    `INSERT INTO certificates (user_id, course_id, certificate_number, verification_code) VALUES ($1, $2, $3, $4)`,
    [userId, courseId, generateCertificateNumber(), generateVerificationCode()],
  );
}

export async function listCertificates(pool: Pool, userId: string): Promise<CertificateSummary[]> {
  const { rows } = await pool.query<CertificateRow>(
    `SELECT cert.id, cert.certificate_number, cert.verification_code, cert.issued_at, cert.course_id, c.title, c.slug
     FROM certificates cert
     JOIN courses c ON c.id = cert.course_id
     WHERE cert.user_id = $1
     ORDER BY cert.issued_at DESC`,
    [userId],
  );
  return rows.map(toCertificateSummary);
}

export async function getCertificateById(pool: Pool, userId: string, certificateId: string): Promise<CertificateSummary> {
  const { rows } = await pool.query<CertificateRow>(
    `SELECT cert.id, cert.certificate_number, cert.verification_code, cert.issued_at, cert.course_id, c.title, c.slug
     FROM certificates cert
     JOIN courses c ON c.id = cert.course_id
     WHERE cert.id = $1 AND cert.user_id = $2`,
    [certificateId, userId],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'CERTIFICATE_NOT_FOUND', 'Certificate could not be found');
  }
  return toCertificateSummary(rows[0]);
}

// Public lookup (no auth) — only exposes what a third party verifying a certificate needs.
export async function verifyCertificate(pool: Pool, verificationCode: string): Promise<CertificateVerification> {
  const { rows } = await pool.query<{
    certificate_number: string;
    issued_at: string;
    course_title: string;
    student_name: string;
  }>(
    `SELECT cert.certificate_number, cert.issued_at, c.title AS course_title, u.display_name AS student_name
     FROM certificates cert
     JOIN courses c ON c.id = cert.course_id
     JOIN users u ON u.id = cert.user_id
     WHERE cert.verification_code = $1`,
    [verificationCode],
  );
  if (rows.length === 0) {
    throw new AppError(404, 'CERTIFICATE_NOT_FOUND', 'Certificate could not be found');
  }
  const row = rows[0];
  return {
    certificateNumber: row.certificate_number,
    issuedAt: row.issued_at,
    courseTitle: row.course_title,
    studentName: row.student_name,
  };
}
