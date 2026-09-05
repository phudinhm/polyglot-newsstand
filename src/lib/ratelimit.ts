interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Token bucket keyed by caller. Guards the translation route, which spends
 * real money or quota on someone else's API.
 */
export function rateLimit(
  key: string,
  { capacity = 60, refillPerMinute = 60 } = {},
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const elapsedMinutes = (now - bucket.updatedAt) / 60_000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedMinutes * refillPerMinute);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const secondsPerToken = 60 / refillPerMinute;
    return { ok: false, retryAfterSeconds: Math.ceil(secondsPerToken) };
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  if (buckets.size > 5_000) {
    // Keep memory bounded on a busy instance.
    for (const [k, b] of buckets) {
      if (now - b.updatedAt > 10 * 60_000) buckets.delete(k);
    }
  }
  return { ok: true, retryAfterSeconds: 0 };
}

export function callerKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
}
