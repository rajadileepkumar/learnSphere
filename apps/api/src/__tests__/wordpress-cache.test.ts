import { describe, expect, it, vi } from 'vitest';
import { clearCache, invalidateCache, withCache } from '../modules/wordpress/cache.js';

describe('withCache', () => {
  it('only calls the fetcher once within the TTL window', async () => {
    clearCache();
    const fetcher = vi.fn().mockResolvedValue('value');
    await withCache('key-a', 10_000, fetcher);
    await withCache('key-a', 10_000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after invalidateCache clears a matching prefix', async () => {
    clearCache();
    const fetcher = vi.fn().mockResolvedValue('value');
    await withCache('course:list:20', 10_000, fetcher);
    invalidateCache('course:');
    await withCache('course:list:20', 10_000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps entries under different prefixes independent', async () => {
    clearCache();
    const courseFetcher = vi.fn().mockResolvedValue('course');
    const instructorFetcher = vi.fn().mockResolvedValue('instructor');
    await withCache('course:slug:x', 10_000, courseFetcher);
    await withCache('instructor:slug:y', 10_000, instructorFetcher);
    invalidateCache('course:');
    await withCache('instructor:slug:y', 10_000, instructorFetcher);
    expect(instructorFetcher).toHaveBeenCalledTimes(1);
  });
});
