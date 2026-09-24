import type { CourseListItem } from './api';

export type SortKey = 'popular' | 'rating' | 'newest' | 'shortest' | 'longest';
export type DurationBucket = 'short' | 'medium' | 'long';

export interface CatalogFilters {
  search: string;
  categories: string[];
  levels: string[];
  durations: DurationBucket[];
  featuredOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = { search: '', categories: [], levels: [], durations: [], featuredOnly: false };

export const LEVELS = ['beginner', 'intermediate', 'advanced'];

export const DURATIONS: { key: DurationBucket; label: string }[] = [
  { key: 'short', label: 'Under 2 hours' },
  { key: 'medium', label: '2–4 hours' },
  { key: 'long', label: '4+ hours' },
];

export function durationBucket(minutes: number | null): DurationBucket | null {
  if (minutes === null) return null;
  if (minutes < 120) return 'short';
  if (minutes < 240) return 'medium';
  return 'long';
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// The web app can deploy ahead of the API (Vercel ships on merge; the API deploys separately),
// so an older API may omit the catalog fields. Default them once here so the cards, filters and
// sorters never see undefined — undefined.toFixed() crashed the page, and undefined counts NaN-sort.
export function normalizeCourse(c: Partial<CourseListItem> & Pick<CourseListItem, 'id' | 'slug' | 'title'>): CourseListItem {
  return {
    thumbnailUrl: null,
    durationMinutes: null,
    difficulty: null,
    publishedAt: null,
    ...c,
    category: c.category ?? null,
    shortDescription: c.shortDescription ?? null,
    instructorName: c.instructorName ?? null,
    featured: c.featured ?? false,
    enrollmentCount: c.enrollmentCount ?? 0,
    lessonCount: c.lessonCount ?? 0,
    averageRating: c.averageRating ?? null,
    reviewCount: c.reviewCount ?? 0,
  };
}

export function categoryOf(course: CourseListItem): string {
  return course.category ?? 'General';
}

function matches(course: CourseListItem, f: CatalogFilters, skip?: keyof CatalogFilters): boolean {
  const q = f.search.trim().toLowerCase();
  if (skip !== 'search' && q) {
    const haystack = [course.title, course.shortDescription, course.instructorName, course.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (skip !== 'categories' && f.categories.length && !f.categories.includes(categoryOf(course))) return false;
  if (skip !== 'levels' && f.levels.length && !f.levels.includes(course.difficulty ?? '')) return false;
  if (skip !== 'durations' && f.durations.length) {
    const bucket = durationBucket(course.durationMinutes);
    if (!bucket || !f.durations.includes(bucket)) return false;
  }
  if (skip !== 'featuredOnly' && f.featuredOnly && !course.featured) return false;
  return true;
}

const SORTERS: Record<SortKey, (a: CourseListItem, b: CourseListItem) => number> = {
  popular: (a, b) => b.enrollmentCount - a.enrollmentCount || Number(b.featured) - Number(a.featured),
  rating: (a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0) || b.reviewCount - a.reviewCount,
  newest: (a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  shortest: (a, b) => (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity),
  longest: (a, b) => (b.durationMinutes ?? 0) - (a.durationMinutes ?? 0),
};

// ponytail: filtering happens client-side over one page of up to 50 courses (the API's max
// pageSize). Move the filters to API query params once the catalogue outgrows that.
export function filterAndSort(courses: CourseListItem[], f: CatalogFilters, sort: SortKey): CourseListItem[] {
  return courses.filter((c) => matches(c, f)).sort(SORTERS[sort]);
}

// Counts per option, computed against every *other* active filter, so each number shows what
// ticking that option would actually return.
export function facetCounts(courses: CourseListItem[], f: CatalogFilters) {
  const count = <K extends string>(skip: keyof CatalogFilters, keyOf: (c: CourseListItem) => K | null) => {
    const out = new Map<K, number>();
    for (const c of courses) {
      if (!matches(c, f, skip)) continue;
      const k = keyOf(c);
      if (k !== null) out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
  };
  return {
    categories: count('categories', categoryOf),
    levels: count('levels', (c) => c.difficulty),
    durations: count('durations', (c) => durationBucket(c.durationMinutes)),
  };
}
