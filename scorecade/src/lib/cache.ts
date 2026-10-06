// In-memory cache with TTL + stale-on-error + in-flight dedupe,
// plus a serialized task queue (replaces Cloudflare KV from the original design).

export class UpstreamError extends Error {
  constructor(message = "Upstream unavailable") {
    super(message);
    this.name = "UpstreamError";
  }
}

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  ttl: number;
}

const globalStore = globalThis as unknown as {
  __scCache?: Map<string, CacheEntry<unknown>>;
  __scInflight?: Map<string, Promise<unknown>>;
};

const cache: Map<string, CacheEntry<unknown>> =
  globalStore.__scCache ?? new Map();
globalStore.__scCache = cache;

const inflight: Map<string, Promise<unknown>> =
  globalStore.__scInflight ?? new Map();
globalStore.__scInflight = inflight;

export function cacheGet<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined;
}

export function cacheSet<T>(key: string, value: T, ttl: number): void {
  cache.set(key, { value, fetchedAt: Date.now(), ttl });
}

/**
 * Get-or-fetch with:
 * - fresh hit: return immediately
 * - stale hit: revalidate; on upstream error return stale data (stale-on-error)
 * - miss: fetch; on error throw UpstreamError
 */
export async function cached<T>(
  key: string,
  ttl: number,
  negativeTtl: number,
  fetcher: () => Promise<T | null>,
): Promise<T | null> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T | null> | undefined;

  if (entry && now - entry.fetchedAt < entry.ttl) {
    return entry.value;
  }

  const running = inflight.get(key) as Promise<T | null> | undefined;
  if (running) return running;

  const task = (async () => {
    try {
      const value = await fetcher();
      cache.set(key, {
        value,
        fetchedAt: Date.now(),
        ttl: value === null ? negativeTtl : ttl,
      });
      return value;
    } catch (err) {
      // Stale-on-error: serve old data if we have any
      if (entry) return entry.value;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ensures tasks run strictly one after another with a minimum gap. */
export function createQueue(minGapMs: number) {
  const state = { last: 0 };
  let chain: Promise<unknown> = Promise.resolve();

  return function run<T>(task: () => Promise<T>): Promise<T> {
    const exec = chain.then(async () => {
      const wait = state.last + minGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      state.last = Date.now();
      return task();
    });
    chain = exec.catch(() => undefined);
    return exec as Promise<T>;
  };
}
