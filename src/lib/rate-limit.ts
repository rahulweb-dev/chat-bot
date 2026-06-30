// In-memory sliding-window rate limiter.
// Works for single-process deployments (Next.js local / single Vercel instance).
// For multi-instance / edge deployments, replace the Map with an Upstash Redis store.
import { NextResponse } from "next/server";

const store = new Map<string, number[]>();

/**
 * Returns true when the request is within the allowed rate.
 * Returns false when the limit is exceeded.
 */
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= maxRequests) return false;
  hits.push(now);
  store.set(key, hits);
  return true;
}

export function rateLimitError() {
  return NextResponse.json(
    { success: false, error: "Too many requests — please slow down." },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}

/** Convenience: derive a key from the forwarded IP or a fallback. */
export function ipKey(request: Request, suffix?: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}
