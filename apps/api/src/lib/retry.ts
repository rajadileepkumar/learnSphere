// Retries a transient failure (network error / 5xx) a fixed number of times with a short
// fixed backoff. Callers decide what counts as retryable by what they let escape shouldRetry.
export async function withRetry<T>(fn: () => Promise<T>, options: { retries?: number; delayMs?: number } = {}): Promise<T> {
  const { retries = 2, delayMs = 300 } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}
