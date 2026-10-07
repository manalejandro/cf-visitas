/** Best-effort in-memory rate limiting (per Worker isolate). */

interface RateBucket {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateBucket>>();

/**
 * Returns `true` when the request is allowed.
 * Limits are per isolate — Cloudflare may run several isolates, so this is a
 * best-effort guard, not a global quota.
 */
export function rateLimit(scope: string, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let store = stores.get(scope);
  if (!store) {
    store = new Map();
    stores.set(scope, store);
  }

  // Opportunistic cleanup to keep the map bounded.
  if (store.size > 5_000) {
    for (const [entryKey, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(entryKey);
    }
  }

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}
