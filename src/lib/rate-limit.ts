// Simple sliding-window rate limiter (in-memory, per key).

interface LimiterStore {
  buckets: Map<string, number[]>;
}

const globalStore = globalThis as unknown as { __scLimiter?: LimiterStore };
const store: LimiterStore = globalStore.__scLimiter ?? {
  buckets: new Map(),
};
globalStore.__scLimiter = store;

export function checkRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (store.buckets.size > 5000) store.buckets.clear(); // safety valve
  const timestamps = (store.buckets.get(key) ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (timestamps.length >= limit) {
    store.buckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  store.buckets.set(key, timestamps);
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "local";
}
