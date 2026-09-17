import { AppError } from '../../lib/errors.js';
import { getCourseBySlug } from '../wordpress/repository.js';
import type { WPLesson } from '../wordpress/types.js';

export interface ContentChunk {
  wpContentId: number;
  sourceType: string;
  title: string;
  url: string | null;
  text: string;
  relevanceScore: number;
}

// Behind an interface per specs/08-AI-SPEC.md Phase 2 note, so this naive keyword scorer
// can be swapped for embeddings + a vector store later without touching callers.
export interface ContentRetriever {
  retrieve(courseSlug: string, question: string, limit?: number): Promise<ContentChunk[]>;
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  const hits = terms.filter((term) => term.length > 2 && lower.includes(term)).length;
  return terms.length === 0 ? 0 : hits / terms.length;
}

function lessonToChunk(lesson: WPLesson, courseSlug: string, score: number): ContentChunk {
  return {
    wpContentId: lesson.wpId,
    sourceType: 'lesson',
    title: lesson.title,
    url: `/courses/${courseSlug}/lessons/${lesson.wpId}`,
    text: [lesson.title, lesson.content ?? '', lesson.objectives.join(' ')].filter(Boolean).join('\n'),
    relevanceScore: score,
  };
}

// ponytail: keyword overlap, not semantic search — fine for small course catalogs, upgrade
// to embeddings + pgvector/a vector store once content volume makes recall matter.
class KeywordCourseRetriever implements ContentRetriever {
  async retrieve(courseSlug: string, question: string, limit = 3): Promise<ContentChunk[]> {
    let course;
    try {
      course = await getCourseBySlug(courseSlug);
    } catch (err) {
      if (err instanceof AppError) return [];
      throw err;
    }
    if (!course) return [];

    const terms = question.toLowerCase().split(/\W+/).filter(Boolean);
    const lessons = course.modules.flatMap((m) => m.lessons);
    return lessons
      .map((lesson) => lessonToChunk(lesson, courseSlug, scoreText(`${lesson.title} ${lesson.content ?? ''}`, terms)))
      .filter((chunk) => chunk.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }
}

export function getContentRetriever(): ContentRetriever {
  return new KeywordCourseRetriever();
}
