import crypto from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };
const developmentBuckets = new Map<string, Bucket>();
const distributedLimiters = new Map<string, Ratelimit>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function hasDistributedRateLimitConfig() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function identifierDigest(value: string) {
  const key = process.env.APP_SECRET?.trim() || "development-rate-limit-key";
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

function getDistributedLimiter(limit: number, windowMs: number) {
  const cacheKey = `${limit}:${windowMs}`;
  const cached = distributedLimiters.get(cacheKey);
  if (cached) {
    return cached;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    prefix: "yapp:ratelimit",
    analytics: false,
    timeout: 0,
  });
  distributedLimiters.set(cacheKey, limiter);
  return limiter;
}

function checkDevelopmentRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  if (developmentBuckets.size > 5_000) {
    for (const [key, bucket] of developmentBuckets) {
      if (bucket.resetAt <= now) {
        developmentBuckets.delete(key);
      }
    }
  }

  const bucket = developmentBuckets.get(input.key);
  if (!bucket || bucket.resetAt <= now) {
    developmentBuckets.set(input.key, {
      count: 1,
      resetAt: now + input.windowMs,
    });
    return { ok: true, remaining: input.limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  return bucket.count <= input.limit
    ? {
        ok: true,
        remaining: input.limit - bucket.count,
        retryAfterSeconds: 0,
      }
    : {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1000),
        ),
      };
}

export function getRateLimitClientKey(request: Request) {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstIp = (vercelForwardedFor || forwardedFor)
    ?.split(",")[0]
    ?.trim();
  if (firstIp) {
    return firstIp;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function enforceRateLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowMs: number;
  extraKey?: string;
}) {
  const rawIdentifier = `${input.scope}:${getRateLimitClientKey(input.request)}:${
    input.extraKey ?? ""
  }`;
  const identifier = identifierDigest(rawIdentifier);

  if (!hasDistributedRateLimitConfig()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Abuse-protection service unavailable." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const result = checkDevelopmentRateLimit({
      key: identifier,
      limit: input.limit,
      windowMs: input.windowMs,
    });
    return result.ok ? null : rateLimitResponse(result);
  }

  try {
    const result = await getDistributedLimiter(input.limit, input.windowMs).limit(
      identifier,
    );
    if (result.success) {
      return null;
    }
    return rateLimitResponse({
      ok: false,
      remaining: result.remaining,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1000),
      ),
    });
  } catch {
    return NextResponse.json(
      { error: "Abuse-protection service unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
