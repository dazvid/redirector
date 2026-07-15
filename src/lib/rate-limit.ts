/**
 * A tiny in-process, fixed-window rate limiter. Good enough for a
 * single-instance deployment (the default docker-compose runs one `app`
 * container); if you scale to multiple replicas, swap the Map for a shared
 * store (e.g. Redis) keyed the same way — the call sites won't change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic pruning so the Map can't grow without bound from one-off
// IPs. Cheap: only sweeps when the map crosses a threshold.
const PRUNE_THRESHOLD = 10_000;

function prune(now: number): void {
  if (buckets.size < PRUNE_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — populate a Retry-After header with this. */
  retryAfterSeconds: number;
}

/**
 * Records one attempt for `key` and reports whether it's within `limit`
 * per `windowMs`. `now` is injectable for tests.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  prune(now);
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test-only: clear all buckets so cases don't bleed into each other. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client IP. Behind Caddy (see docker-compose.yml), the real
 * client address arrives in X-Forwarded-For; we take the first hop. Falls
 * back to X-Real-IP, then a constant so a missing header degrades to a
 * shared bucket rather than throwing.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
