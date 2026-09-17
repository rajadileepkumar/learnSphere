// Normalized shapes for the content model in specs/05-WORDPRESS-CMS-SPEC.md.
// GraphQL field names in queries.ts follow common WPGraphQL + ACF conventions and
// may need adjusting once the live WPGraphQL schema is introspected.

export interface WPResource {
  title: string;
  url: string;
}

export interface WPLesson {
  wpId: number;
  slug: string;
  title: string;
  lessonType: string;
  content: string | null;
  videoUrl: string | null;
  durationMinutes: number | null;
  objectives: string[];
  resources: WPResource[];
  order: number;
  isRequired: boolean;
}

export interface WPModule {
  wpId: number;
  title: string;
  description: string | null;
  order: number;
  lessons: WPLesson[];
}

export interface WPInstructorSummary {
  wpId: number;
  slug: string;
  name: string;
  photoUrl: string | null;
}

export interface WPInstructor extends WPInstructorSummary {
  bio: string | null;
  expertise: string[];
  socialLinks: WPResource[];
}

export interface WPCourse {
  wpId: number;
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
  shortDescription: string | null;
  description: string | null;
  featuredImageUrl: string | null;
  durationMinutes: number | null;
  difficulty: string | null;
  category: string | null;
  tags: string[];
  instructor: WPInstructorSummary | null;
  learningObjectives: string[];
  prerequisites: string[];
  targetAudience: string | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  modules: WPModule[];
}
