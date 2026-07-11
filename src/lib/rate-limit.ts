import { NextResponse } from "next/server";

/**
 * Fixed-window in-memory rate limiter for abuse-prone endpoints
 * (sign-in, sign-up, admin sign-in, coupon redemption, trial start).
 *
 * State lives in module memory, so on serverless platforms each warm
 * instance keeps its own counters. That still blunts brute-force and
 * credential-stuffing loops, which hammer a single warm instance. For a
 * global guarantee swap `checkRateLimit` for a Redis-backed
 * implementation (e.g. @upstash/ratelimit) behind the same interface.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

function pruneExpired(now: number) {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
  // Under sustained pressure drop oldest entries instead of growing unbounded.
  if (buckets.size >= MAX_BUCKETS) {
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (buckets.size < MAX_BUCKETS / 2) {
        break;
      }
    }
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const bucket = buckets.get(input.key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { ok: true, remaining: input.limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > input.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: input.limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

export function getRateLimitClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstIp = forwardedFor?.split(",")[0]?.trim();
  if (firstIp) {
    return firstIp;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

export function enforceRateLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowMs: number;
  extraKey?: string;
}) {
  const clientKey = getRateLimitClientKey(input.request);
  const result = checkRateLimit({
    key: `${input.scope}:${clientKey}${input.extraKey ? `:${input.extraKey}` : ""}`,
    limit: input.limit,
    windowMs: input.windowMs,
  });

  return result.ok ? null : rateLimitResponse(result);
}
