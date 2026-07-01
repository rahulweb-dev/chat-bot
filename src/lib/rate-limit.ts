import { NextResponse } from "next/server";
import { getRedisConnection, isRedisAvailable } from "./queue/connection";

// In-memory fallback when Redis is unavailable
const memStore = new Map<string, number[]>();

async function redisIncr(key: string, windowSecs: number): Promise<number> {
  const redis = getRedisConnection();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSecs + 1);
  return count;
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const windowSecs = Math.ceil(windowMs / 1000);
  const window = Math.floor(Date.now() / windowMs);
  const rKey = `rl:${key}:${window}`;

  const available = await isRedisAvailable(400);
  if (available) {
    const count = await redisIncr(rKey, windowSecs);
    return count <= maxRequests;
  }

  // In-memory fallback
  const now = Date.now();
  const hits = (memStore.get(rKey) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= maxRequests) return false;
  hits.push(now);
  memStore.set(rKey, hits);
  return true;
}

export function rateLimitError() {
  return NextResponse.json(
    { success: false, error: "Too many requests — please slow down." },
    { status: 429, headers: { "Retry-After": "60", "Access-Control-Allow-Origin": "*" } }
  );
}

export function ipKey(request: Request, suffix?: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}
