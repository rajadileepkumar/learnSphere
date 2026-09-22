import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ breaks: true });

// AI Tutor replies are markdown; render them as HTML rather than showing raw ###/** syntax.
// DOMPurify strips anything unsafe (scripts, event handlers, etc.) since this is model output,
// not content we authored ourselves.
export function renderMarkdown(content: string): string {
  const html = marked.parse(content, { async: false });
  return DOMPurify.sanitize(html);
}
