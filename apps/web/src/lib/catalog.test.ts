import { describe, expect, it } from 'vitest';
import type { CourseListItem } from './api';
import { EMPTY_FILTERS, facetCounts, filterAndSort, formatDuration, normalizeCourse } from './catalog';

const course = (over: Partial<CourseListItem>): CourseListItem => ({
  id: over.slug ?? 'x',
  slug: 'x',
  title: 'Course',
  thumbnailUrl: null,
  durationMinutes: 60,
  difficulty: 'beginner',
  publishedAt: '2026-01-01',
  category: 'Programming',
  shortDescription: null,
  instructorName: null,
  featured: false,
  enrollmentCount: 0,
  lessonCount: 1,
  averageRating: null,
  reviewCount: 0,
  ...over,
});

const courses = [
  course({ slug: 'js', title: 'JavaScript', category: 'Programming', durationMinutes: 180, enrollmentCount: 5 }),
  course({ slug: 'sql', title: 'SQL', category: 'Data', difficulty: 'intermediate', durationMinutes: 90, averageRating: 4.5, reviewCount: 3 }),
  course({ slug: 'k8s', title: 'Kubernetes', category: 'Cloud', difficulty: 'advanced', durationMinutes: 300, featured: true, instructorName: 'Daniel' }),
];
const slugs = (cs: CourseListItem[]) => cs.map((c) => c.slug);

describe('catalog filtering', () => {
  it('searches title, instructor and category case-insensitively', () => {
    expect(slugs(filterAndSort(courses, { ...EMPTY_FILTERS, search: 'daniel' }, 'popular'))).toEqual(['k8s']);
    expect(slugs(filterAndSort(courses, { ...EMPTY_FILTERS, search: 'DATA' }, 'popular'))).toEqual(['sql']);
  });

  it('ORs within a facet and ANDs across facets', () => {
    const f = { ...EMPTY_FILTERS, categories: ['Programming', 'Data'], levels: ['beginner'] };
    expect(slugs(filterAndSort(courses, f, 'popular'))).toEqual(['js']);
  });

  it('buckets durations and filters featured', () => {
    expect(slugs(filterAndSort(courses, { ...EMPTY_FILTERS, durations: ['short'] }, 'popular'))).toEqual(['sql']);
    expect(slugs(filterAndSort(courses, { ...EMPTY_FILTERS, featuredOnly: true }, 'popular'))).toEqual(['k8s']);
  });

  it('sorts by rating, duration and popularity', () => {
    expect(slugs(filterAndSort(courses, EMPTY_FILTERS, 'rating'))[0]).toBe('sql');
    expect(slugs(filterAndSort(courses, EMPTY_FILTERS, 'shortest'))).toEqual(['sql', 'js', 'k8s']);
    expect(slugs(filterAndSort(courses, EMPTY_FILTERS, 'popular'))[0]).toBe('js');
  });

  it('counts each facet against the other active filters only', () => {
    const counts = facetCounts(courses, { ...EMPTY_FILTERS, categories: ['Data'] });
    // The category facet ignores its own selection, so every category still shows its count...
    expect(counts.categories.get('Programming')).toBe(1);
    // ...while other facets are narrowed to the selected category.
    expect(counts.levels.get('intermediate')).toBe(1);
    expect(counts.levels.get('beginner')).toBeUndefined();
  });

  it('defaults fields an older API omits, so rendering and sorting stay safe', () => {
    // Shape the pre-0005 API returned: no catalog fields or stats at all.
    const old = normalizeCourse({ id: '1', slug: 'old', title: 'Old', durationMinutes: 60, difficulty: 'beginner' });
    expect(old).toMatchObject({ averageRating: null, enrollmentCount: 0, lessonCount: 0, reviewCount: 0, featured: false, category: null });
    const sorted = filterAndSort([old, courses[0]], EMPTY_FILTERS, 'popular');
    expect(slugs(sorted)).toEqual(['js', 'old']);
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(210)).toBe('3h 30m');
    expect(formatDuration(null)).toBeNull();
  });
});
