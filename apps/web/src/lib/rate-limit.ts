import { ApiError } from "./errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new ApiError("RATE_LIMITED", 429, "Too many requests");
  }

  bucket.count += 1;
}
