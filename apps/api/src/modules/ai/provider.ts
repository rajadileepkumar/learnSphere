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

const REQUEST_TIMEOUT_MS = 20000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
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

// One retry for a transient network blip or momentary 5xx — only ever hit when the first
// attempt produced no completion at all, so there's nothing to duplicate by trying again.
const postWithRetry = (url: string, headers: Record<string, string>, body: unknown) =>
  withRetry(() => postJson(url, headers, body), { retries: 1, delayMs: 300 });

// ponytail: cheapest current model per provider for a Q&A tutor bot; swap via a real config
// knob if a heavier model is ever needed for specific courses.
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.0-flash';

class AnthropicProvider implements AIProvider {
  async generate(system: string, messages: AIMessage[]): Promise<AIGenerateResult> {
    const res = await postWithRetry(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': env.AI_API_KEY!, 'anthropic-version': '2023-06-01' },
      { model: ANTHROPIC_MODEL, max_tokens: 1024, system, messages },
    );
    const body = (await res.json()) as {
      content: { type: string; text: string }[];
      model: string;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = body.content.find((block) => block.type === 'text')?.text ?? '';
    return { content: text, model: body.model, inputTokens: body.usage?.input_tokens ?? null, outputTokens: body.usage?.output_tokens ?? null };
  }
}

// Groq: free tier (console.groq.com), OpenAI-compatible chat completions endpoint.
class GroqProvider implements AIProvider {
  async generate(system: string, messages: AIMessage[]): Promise<AIGenerateResult> {
    const res = await postWithRetry(
      'https://api.groq.com/openai/v1/chat/completions',
      { authorization: `Bearer ${env.GROQ_API_KEY}` },
      { model: GROQ_MODEL, max_tokens: 1024, messages: [{ role: 'system', content: system }, ...messages] },
    );
    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const text = body.choices[0]?.message.content ?? '';
    return { content: text, model: body.model, inputTokens: body.usage?.prompt_tokens ?? null, outputTokens: body.usage?.completion_tokens ?? null };
  }
}

// Gemini: free tier (aistudio.google.com), Generative Language API.
class GeminiProvider implements AIProvider {
  async generate(system: string, messages: AIMessage[]): Promise<AIGenerateResult> {
    const res = await postWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {},
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      },
    );
    const body = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
    };
    const text = body.candidates[0]?.content.parts.map((p) => p.text).join('') ?? '';
    return { content: text, model: GEMINI_MODEL, inputTokens: body.usageMetadata?.promptTokenCount ?? null, outputTokens: body.usageMetadata?.candidatesTokenCount ?? null };
  }
}

// Deterministic offline stand-in — used whenever no provider key is configured, so the
// AI Tutor stays fully runnable (and testable) without a live provider, mirroring the
// dev-memory DB fallback used elsewhere in this app.
class MockAIProvider implements AIProvider {
  async generate(system: string, messages: AIMessage[]): Promise<AIGenerateResult> {
    const question = messages[messages.length - 1]?.content ?? '';
    const grounded = system.includes('Context:\n(no relevant course material found)') === false;
    const content = grounded
      ? `Based on the course material provided: ${question}\n\n(This is a mock response — configure GROQ_API_KEY, GEMINI_API_KEY or AI_API_KEY for real answers.)`
      : `I don't have specific course material for that question, so here's a general answer: ${question}\n\n(This is a mock response — configure GROQ_API_KEY, GEMINI_API_KEY or AI_API_KEY for real answers.)`;
    return { content, model: 'mock-tutor-v1', inputTokens: null, outputTokens: null };
  }
}

// Groq and Gemini both have a genuinely free tier, so they're tried before the paid Anthropic key.
export function getAIProvider(): AIProvider {
  if (env.GROQ_API_KEY) return new GroqProvider();
  if (env.GEMINI_API_KEY) return new GeminiProvider();
  if (env.AI_API_KEY) return new AnthropicProvider();
  return new MockAIProvider();
}
