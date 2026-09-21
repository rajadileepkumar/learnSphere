import { wpFetch } from './client.js';
import type { WPCourse, WPInstructor, WPInstructorSummary, WPLesson, WPModule, WPResource } from './types.js';

// Field names follow the content model in specs/05-WORDPRESS-CMS-SPEC.md, using
// common WPGraphQL + ACF conventions. Adjust once the live schema is introspected.
const COURSE_FRAGMENT = `
  databaseId
  slug
  title
  status
  date
  courseFields {
    shortDescription
    description
    duration
    difficulty
    category
    tags
    featured
    seoTitle
    seoDescription
    targetAudience
    learningObjectives
    prerequisites
    featuredImage { node { sourceUrl } }
    instructor {
      ... on Instructor {
        databaseId
        slug
        title
        instructorFields { photo { node { sourceUrl } } }
      }
    }
  }
  modules {
    nodes {
      databaseId
      title
      moduleFields { description order }
      lessons {
        nodes {
          databaseId
          slug
          title
          lessonFields {
            lessonType
            content
            videoUrl
            duration
            objectives
            order
            required
            resources { title url }
          }
        }
      }
    }
  }
`;

const GET_COURSES = `
  query GetCourses($first: Int!) {
    courses(first: $first, where: { status: PUBLISH }) {
      nodes { ${COURSE_FRAGMENT} }
    }
  }
`;

const GET_COURSE_BY_SLUG = `
  query GetCourseBySlug($slug: ID!) {
    course(id: $slug, idType: SLUG) { ${COURSE_FRAGMENT} }
  }
`;

const GET_COURSE_BY_DATABASE_ID = `
  query GetCourseByDatabaseId($id: ID!) {
    course(id: $id, idType: DATABASE_ID) { ${COURSE_FRAGMENT} }
  }
`;

const GET_LESSON_PARENT_COURSE = `
  query GetLessonParentCourse($id: ID!) {
    lesson(id: $id, idType: DATABASE_ID) {
      module { course { databaseId } }
    }
  }
`;

const GET_INSTRUCTOR_FRAGMENT = `
  databaseId
  slug
  title
  instructorFields {
    bio
    expertise
    socialLinks { title url }
    photo { node { sourceUrl } }
  }
`;

const GET_INSTRUCTOR_BY_SLUG = `
  query GetInstructorBySlug($slug: ID!) {
    instructor(id: $slug, idType: SLUG) { ${GET_INSTRUCTOR_FRAGMENT} }
  }
`;

interface RawImage {
  node?: { sourceUrl?: string | null } | null;
}

interface RawInstructorRef {
  databaseId: number;
  slug: string;
  title: string;
  instructorFields?: { photo?: RawImage | null } | null;
}

interface RawLesson {
  databaseId: number;
  slug: string;
  title: string;
  lessonFields?: {
    lessonType?: string | null;
    content?: string | null;
    videoUrl?: string | null;
    duration?: number | null;
    objectives?: string[] | null;
    order?: number | null;
    required?: boolean | null;
    resources?: WPResource[] | null;
  } | null;
}

interface RawModule {
  databaseId: number;
  title: string;
  moduleFields?: { description?: string | null; order?: number | null } | null;
  lessons?: { nodes?: RawLesson[] | null } | null;
}

interface RawCourse {
  databaseId: number;
  slug: string;
  title: string;
  status: string;
  date: string | null;
  courseFields?: {
    shortDescription?: string | null;
    description?: string | null;
    duration?: number | null;
    difficulty?: string | null;
    category?: string | null;
    tags?: string[] | null;
    featured?: boolean | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    targetAudience?: string | null;
    learningObjectives?: string[] | null;
    prerequisites?: string[] | null;
    featuredImage?: RawImage | null;
    instructor?: RawInstructorRef | null;
  } | null;
  modules?: { nodes?: RawModule[] | null } | null;
}

function normalizeInstructorSummary(raw: RawInstructorRef | null | undefined): WPInstructorSummary | null {
  if (!raw) return null;
  return {
    wpId: raw.databaseId,
    slug: raw.slug,
    name: raw.title,
    photoUrl: raw.instructorFields?.photo?.node?.sourceUrl ?? null,
  };
}

function normalizeLesson(raw: RawLesson): WPLesson {
  const fields = raw.lessonFields ?? {};
  return {
    wpId: raw.databaseId,
    slug: raw.slug,
    title: raw.title,
    lessonType: fields.lessonType ?? 'lesson',
    content: fields.content ?? null,
    videoUrl: fields.videoUrl ?? null,
    durationMinutes: fields.duration ?? null,
    objectives: fields.objectives ?? [],
    resources: fields.resources ?? [],
    order: fields.order ?? 0,
    isRequired: fields.required ?? true,
  };
}

function normalizeModule(raw: RawModule): WPModule {
  const fields = raw.moduleFields ?? {};
  return {
    wpId: raw.databaseId,
    title: raw.title,
    description: fields.description ?? null,
    order: fields.order ?? 0,
    lessons: (raw.lessons?.nodes ?? []).map(normalizeLesson),
  };
}

function normalizeCourse(raw: RawCourse): WPCourse {
  const fields = raw.courseFields ?? {};
  return {
    wpId: raw.databaseId,
    slug: raw.slug,
    title: raw.title,
    status: raw.status,
    publishedAt: raw.date ?? null,
    shortDescription: fields.shortDescription ?? null,
    description: fields.description ?? null,
    featuredImageUrl: fields.featuredImage?.node?.sourceUrl ?? null,
    durationMinutes: fields.duration ?? null,
    difficulty: fields.difficulty ?? null,
    category: fields.category ?? null,
    tags: fields.tags ?? [],
    instructor: normalizeInstructorSummary(fields.instructor),
    learningObjectives: fields.learningObjectives ?? [],
    prerequisites: fields.prerequisites ?? [],
    targetAudience: fields.targetAudience ?? null,
    featured: fields.featured ?? false,
    seoTitle: fields.seoTitle ?? null,
    seoDescription: fields.seoDescription ?? null,
    modules: (raw.modules?.nodes ?? []).map(normalizeModule),
  };
}

export async function fetchCourses(first = 20): Promise<WPCourse[]> {
  const data = await wpFetch<{ courses: { nodes: RawCourse[] } }>(GET_COURSES, { first });
  return data.courses.nodes.map(normalizeCourse);
}

export async function fetchCourseBySlug(slug: string): Promise<WPCourse | null> {
  const data = await wpFetch<{ course: RawCourse | null }>(GET_COURSE_BY_SLUG, { slug });
  return data.course ? normalizeCourse(data.course) : null;
}

export async function fetchCourseByWpId(wpId: number): Promise<WPCourse | null> {
  const data = await wpFetch<{ course: RawCourse | null }>(GET_COURSE_BY_DATABASE_ID, { id: String(wpId) });
  return data.course ? normalizeCourse(data.course) : null;
}

export async function fetchLessonParentCourseId(lessonWpId: number): Promise<number | null> {
  const data = await wpFetch<{ lesson: { module?: { course?: { databaseId: number } | null } | null } | null }>(
    GET_LESSON_PARENT_COURSE,
    { id: String(lessonWpId) },
  );
  return data.lesson?.module?.course?.databaseId ?? null;
}

export async function fetchInstructorBySlug(slug: string): Promise<WPInstructor | null> {
  const data = await wpFetch<{ instructor: RawInstructorRef & { instructorFields?: { bio?: string | null; expertise?: string[] | null; socialLinks?: WPResource[] | null } } | null }>(
    GET_INSTRUCTOR_BY_SLUG,
    { slug },
  );
  const raw = data.instructor;
  if (!raw) return null;
  return {
    wpId: raw.databaseId,
    slug: raw.slug,
    name: raw.title,
    photoUrl: raw.instructorFields?.photo?.node?.sourceUrl ?? null,
    bio: raw.instructorFields?.bio ?? null,
    expertise: raw.instructorFields?.expertise ?? [],
    socialLinks: raw.instructorFields?.socialLinks ?? [],
  };
}

export interface WPLessonContent {
  html: string | null;
  videoUrl: string | null;
  objectives: string[];
  resources: WPResource[];
}

export async function fetchLessonContent(lessonWpId: number): Promise<WPLessonContent | null> {
  const data = await wpFetch<{ lesson: { lessonFields?: RawLesson['lessonFields'] } | null }>(
    `query GetLessonContent($id: ID!) {
      lesson(id: $id, idType: DATABASE_ID) { lessonFields { content videoUrl objectives resources { title url } } }
    }`,
    { id: String(lessonWpId) },
  );
  const f = data.lesson?.lessonFields;
  if (!f) return null;
  return { html: f.content ?? null, videoUrl: f.videoUrl || null, objectives: f.objectives ?? [], resources: f.resources ?? [] };
}
