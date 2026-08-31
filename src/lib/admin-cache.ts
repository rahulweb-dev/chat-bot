import { getRedisConnection, isRedisAvailable } from "./queue/connection";

// Short-TTL read cache for expensive admin rollups (e.g. company campaign stats,
// which fan out into ~10 parallel Mongo queries). Same graceful-degradation
// pattern as rate-limit.ts: skip caching entirely if Redis isn't reachable
// rather than blocking the request on it.
export async function cachedJson<T>(key: string, ttlSecs: number, compute: () => Promise<T>): Promise<T> {
  const available = await isRedisAvailable(400);
  if (!available) return compute();

  const redis = getRedisConnection();
  const cacheKey = `admin-cache:${key}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // fall through to compute
  }

  const value = await compute();
  try {
    await redis.set(cacheKey, JSON.stringify(value), "EX", ttlSecs);
  } catch {
    // best-effort — a failed cache write shouldn't fail the request
  }
  return value;
}

export async function invalidateCachedJson(key: string): Promise<void> {
  const available = await isRedisAvailable(400);
  if (!available) return;
  try {
    await getRedisConnection().del(`admin-cache:${key}`);
  } catch {
    // best-effort
  }
}
