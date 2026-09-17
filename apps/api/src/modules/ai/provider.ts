import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { withRetry } from '../../lib/retry.js';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIGenerateResult {
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

// Behind an interface so the LLM backing the tutor can change (or be mocked in dev/test)
// without touching the conversation/message logic in service.ts.
export interface AIProvider {
  generate(system: string, messages: AIMessage[]): Promise<AIGenerateResult>;
}

// ponytail: cheapest current model for a Q&A tutor bot; swap via a real config knob if a
// heavier model is ever needed for specific courses.
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const REQUEST_TIMEOUT_MS = 20000;

async function postMessages(system: string, messages: AIMessage[]): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.AI_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, system, messages }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new AppError(502, 'AI_PROVIDER_ERROR', `AI provider responded with status ${res.status}`);
    }
    return res;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'AI_PROVIDER_UNREACHABLE', 'Could not reach the AI provider');
  } finally {
    clearTimeout(timeout);
  }
}

class AnthropicProvider implements AIProvider {
  async generate(system: string, messages: AIMessage[]): Promise<AIGenerateResult> {
    // One retry for a transient network blip or momentary 5xx — only ever hit when the first
    // attempt produced no completion at all, so there's nothing to duplicate by trying again.
    const res = await withRetry(() => postMessages(system, messages), { retries: 1, delayMs: 300 });

    const body = (await res.json()) as {
      content: { type: string; text: string }[];
      model: string;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = body.content.find((block) => block.type === 'text')?.text ?? '';
    return {
      content: text,
      model: body.model,
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
    };
  }
}

// Deterministic offline stand-in — used whenever AI_API_KEY isn't configured, so the
// AI Tutor stays fully runnable (and testable) without a live provider, mirroring the
// dev-memory DB fallback used elsewhere in this app.
class MockAIProvider implements AIProvider {
  async generate(system: string, messages: AIMessage[]): Promise<AIGenerateResult> {
    const question = messages[messages.length - 1]?.content ?? '';
    const grounded = system.includes('Context:\n(no relevant course material found)') === false;
    const content = grounded
      ? `Based on the course material provided: ${question}\n\n(This is a mock response — configure AI_API_KEY for real answers.)`
      : `I don't have specific course material for that question, so here's a general answer: ${question}\n\n(This is a mock response — configure AI_API_KEY for real answers.)`;
    return { content, model: 'mock-tutor-v1', inputTokens: null, outputTokens: null };
  }
}

export function getAIProvider(): AIProvider {
  return env.AI_API_KEY ? new AnthropicProvider() : new MockAIProvider();
}
