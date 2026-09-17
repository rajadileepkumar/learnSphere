// Mirrors roles/entities from 02-SRS.md and 04-DATABASE-SCHEMA.md.
// ponytail: hand types, no codegen — add codegen only once the API/DB shapes are stable enough to be worth generating from.

export type Role = 'STUDENT' | 'INSTRUCTOR' | 'CONTENT_ADMIN' | 'PLATFORM_ADMIN';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  avatarUrl?: string;
  status: string;
}

export interface Course {
  id: string;
  wpCourseId: number;
  slug: string;
  title: string;
  status: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  difficulty?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface ApiError {
  error: { code: string; message: string; requestId: string };
}
