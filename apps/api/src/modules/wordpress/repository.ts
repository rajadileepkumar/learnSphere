import { withCache } from './cache.js';
import { fetchCourseBySlug, fetchCourses, fetchInstructorBySlug } from './queries.js';
import type { WPCourse, WPInstructor } from './types.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

export function getCourses(first = 20): Promise<WPCourse[]> {
  return withCache(`course:list:${first}`, CACHE_TTL_MS, () => fetchCourses(first));
}

export function getCourseBySlug(slug: string): Promise<WPCourse | null> {
  return withCache(`course:slug:${slug}`, CACHE_TTL_MS, () => fetchCourseBySlug(slug));
}

export function getInstructorBySlug(slug: string): Promise<WPInstructor | null> {
  return withCache(`instructor:slug:${slug}`, CACHE_TTL_MS, () => fetchInstructorBySlug(slug));
}
