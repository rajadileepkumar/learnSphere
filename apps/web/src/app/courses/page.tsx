'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listCourses, type CourseListItem } from '../../lib/api';
import {
  categoryOf,
  DURATIONS,
  EMPTY_FILTERS,
  facetCounts,
  filterAndSort,
  formatDuration,
  LEVELS,
  type CatalogFilters,
  type SortKey,
} from '../../lib/catalog';
import styles from './catalog.module.css';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Most popular' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'newest', label: 'Newest' },
  { key: 'shortest', label: 'Shortest first' },
  { key: 'longest', label: 'Longest first' },
];

// [icon, gradient from, gradient to] for the categories the CMS uses today.
const CATEGORY_STYLES: Record<string, [string, string, string]> = {
  Programming: ['💻', '#2f5bd3', '#6ea8ff'],
  'Web Development': ['🌐', '#dd4b1f', '#f29a52'],
  Data: ['📊', '#138a6b', '#5fd0a8'],
  Design: ['🎨', '#b8325c', '#f07ea2'],
  'Cloud & DevOps': ['☁️', '#1f7a99', '#62c6e4'],
  'AI & Machine Learning': ['🤖', '#7a3fd1', '#c18cff'],
  Business: ['📈', '#8a6a12', '#e6c35c'],
  Security: ['🔒', '#3c4a5c', '#8fa3bb'],
  Platform: ['🚀', '#17140f', '#6b665c'],
};
const FALLBACK_PALETTES = Object.values(CATEGORY_STYLES).map(([, from, to]) => [from, to]);

// A category added in the CMS later still gets a stable colour, hashed from its name.
function styleFor(category: string): [string, string, string] {
  if (CATEGORY_STYLES[category]) return CATEGORY_STYLES[category];
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [from, to] = FALLBACK_PALETTES[h % FALLBACK_PALETTES.length];
  return ['📘', from, to];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('popular');
  // Only matters on small screens, where the filter panel collapses so courses stay above the fold.
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    listCourses({ pageSize: 50 })
      .then(({ data }) => setCourses(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load courses'));
  }, []);

  const results = useMemo(() => (courses ? filterAndSort(courses, filters, sort) : []), [courses, filters, sort]);
  const counts = useMemo(() => (courses ? facetCounts(courses, filters) : null), [courses, filters]);
  const categories = useMemo(
    () => [...new Set((courses ?? []).map(categoryOf))].sort((a, b) => a.localeCompare(b)),
    [courses],
  );

  const activeChips = [
    ...filters.categories.map((c) => ({ label: c, clear: () => setFilters((f) => ({ ...f, categories: toggle(f.categories, c) })) })),
    ...filters.levels.map((l) => ({ label: cap(l), clear: () => setFilters((f) => ({ ...f, levels: toggle(f.levels, l) })) })),
    ...filters.durations.map((d) => ({
      label: DURATIONS.find((x) => x.key === d)!.label,
      clear: () => setFilters((f) => ({ ...f, durations: toggle(f.durations, d) })),
    })),
    ...(filters.featuredOnly ? [{ label: 'Featured', clear: () => setFilters((f) => ({ ...f, featuredOnly: false })) }] : []),
  ];
  const hasFilters = activeChips.length > 0 || filters.search.trim() !== '';

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>Explore courses</h1>
        <p className={styles.heroSubtitle}>
          {courses ? `${courses.length} courses` : 'Courses'} across programming, data, design, cloud and AI — learn at your own pace.
        </p>
        <input
          type="search"
          className={styles.search}
          placeholder="Search courses, topics or instructors…"
          aria-label="Search courses"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${filtersOpen ? styles.sidebarOpen : ''}`} aria-label="Filters">
          <div className={styles.sidebarHeader}>
            <button
              className={styles.filtersToggle}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters"
            >
              Filters{activeChips.length > 0 ? ` (${activeChips.length})` : ''} <span aria-hidden="true">{filtersOpen ? '▲' : '▼'}</span>
            </button>
            <span className={styles.sidebarTitle}>Filters</span>
            {hasFilters && (
              <button className={styles.clearButton} onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear all
              </button>
            )}
          </div>

          <div id="catalog-filters" className={styles.groups}>
            <FilterGroup title="Category">
              {categories.map((c) => (
                <Check
                  key={c}
                  label={c}
                  count={counts?.categories.get(c) ?? 0}
                  checked={filters.categories.includes(c)}
                  onChange={() => setFilters((f) => ({ ...f, categories: toggle(f.categories, c) }))}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Level">
              {LEVELS.map((l) => (
                <Check
                  key={l}
                  label={cap(l)}
                  count={counts?.levels.get(l) ?? 0}
                  checked={filters.levels.includes(l)}
                  onChange={() => setFilters((f) => ({ ...f, levels: toggle(f.levels, l) }))}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Duration">
              {DURATIONS.map((d) => (
                <Check
                  key={d.key}
                  label={d.label}
                  count={counts?.durations.get(d.key) ?? 0}
                  checked={filters.durations.includes(d.key)}
                  onChange={() => setFilters((f) => ({ ...f, durations: toggle(f.durations, d.key) }))}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="More">
              <Check
                label="Featured only"
                checked={filters.featuredOnly}
                onChange={() => setFilters((f) => ({ ...f, featuredOnly: !f.featuredOnly }))}
              />
            </FilterGroup>
          </div>
        </aside>

        <section className={styles.results}>
          <div className={styles.toolbar}>
            <span className={styles.resultCount}>
              {courses === null ? 'Loading courses…' : `${results.length} ${results.length === 1 ? 'course' : 'courses'}`}
            </span>
            <label className={styles.sortLabel}>
              Sort by
              <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeChips.length > 0 && (
            <div className={styles.chips}>
              {activeChips.map((chip) => (
                <button key={chip.label} className={styles.chip} onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>
                  {chip.label} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}

          {courses === null && !error && (
            <div className={styles.grid}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={`${styles.card} ${styles.skeleton}`} />
              ))}
            </div>
          )}

          {courses !== null && results.length === 0 && (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No courses match your filters</p>
              <p className={styles.emptyText}>Try removing a filter or searching for something broader.</p>
              <button className={styles.primaryButton} onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            </div>
          )}

          {results.length > 0 && (
            <div className={styles.grid}>
              {results.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  const disabled = count === 0 && !checked;
  return (
    <label className={`${styles.check} ${disabled ? styles.checkDisabled : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className={styles.checkLabel}>{label}</span>
      {count !== undefined && <span className={styles.checkCount}>{count}</span>}
    </label>
  );
}

function CourseCard({ course }: { course: CourseListItem }) {
  const category = categoryOf(course);
  const [icon, from, to] = styleFor(category);
  const duration = formatDuration(course.durationMinutes);

  return (
    <Link href={`/courses/${course.slug}`} className={styles.card}>
      {course.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.thumbnailUrl} alt="" className={styles.thumb} />
      ) : (
        <div className={styles.thumb} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
          <span className={styles.thumbIcon} aria-hidden="true">
            {icon}
          </span>
        </div>
      )}
      {course.featured && <span className={styles.featuredBadge}>Featured</span>}

      <div className={styles.cardBody}>
        <span className={styles.cardCategory} style={{ color: from }}>
          {category}
        </span>
        <h2 className={styles.cardTitle}>{course.title}</h2>
        {course.shortDescription && <p className={styles.cardDescription}>{course.shortDescription}</p>}
        {course.instructorName && <p className={styles.instructor}>by {course.instructorName}</p>}

        <div className={styles.metaRow}>
          {course.difficulty && (
            <span className={`${styles.level} ${styles[`level_${course.difficulty}`] ?? ''}`}>{cap(course.difficulty)}</span>
          )}
          {duration && <span>⏱ {duration}</span>}
          {course.lessonCount > 0 && (
            <span>
              📚 {course.lessonCount} {course.lessonCount === 1 ? 'lesson' : 'lessons'}
            </span>
          )}
        </div>

        <div className={styles.cardFooter}>
          {course.averageRating !== null ? (
            <span className={styles.rating}>
              ★ {course.averageRating.toFixed(1)} <span className={styles.muted}>({course.reviewCount})</span>
            </span>
          ) : (
            <span className={styles.newBadge}>New</span>
          )}
          <span className={styles.muted}>
            {course.enrollmentCount} {course.enrollmentCount === 1 ? 'learner' : 'learners'}
          </span>
        </div>
      </div>
    </Link>
  );
}
