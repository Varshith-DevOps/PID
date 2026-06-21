/**
 * @fileoverview In-memory account/IP login lockout.
 * Adds per-account+IP throttling on top of the IP rate limiter so distributed
 * credential-stuffing against a single account is slowed even when each IP stays
 * under the rate limit. No external dependency (in-memory; per-process).
 *
 * NOTE: state is per-process. Under cluster/multi-instance, configure a shared
 * store (e.g. Redis) for cluster-wide lockout. This still meaningfully raises the
 * cost of brute force on a single worker.
 * @module utils/loginGuard
 */

const WINDOW_MS = 15 * 60 * 1000;   // count failures within 15 minutes
const MAX_FAILURES = 10;            // lock after this many failures
const LOCK_MS = 15 * 60 * 1000;     // lockout duration

/** @type {Map<string, { count: number, first: number, lockedUntil: number }>} */
const buckets = new Map();

function keyFor(email, ip) {
  return `${String(email || '').toLowerCase()}|${ip || ''}`;
}

/** Drop expired buckets so the map can't grow unbounded. */
function prune(now) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) {
    if (b.lockedUntil < now && now - b.first > WINDOW_MS) buckets.delete(k);
  }
}

/** @returns {{ locked: boolean, retryAfterSec: number }} */
function check(email, ip) {
  const now = Date.now();
  const b = buckets.get(keyFor(email, ip));
  if (b && b.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

/** Record a failed attempt; locks the key once MAX_FAILURES is reached. */
function recordFailure(email, ip) {
  const now = Date.now();
  prune(now);
  const key = keyFor(email, ip);
  let b = buckets.get(key);
  if (!b || now - b.first > WINDOW_MS) {
    b = { count: 0, first: now, lockedUntil: 0 };
  }
  b.count += 1;
  if (b.count >= MAX_FAILURES) {
    b.lockedUntil = now + LOCK_MS;
    b.count = 0;
    b.first = now;
  }
  buckets.set(key, b);
  return b.lockedUntil > now;
}

/** Clear the bucket after a successful login. */
function reset(email, ip) {
  buckets.delete(keyFor(email, ip));
}

module.exports = { check, recordFailure, reset, MAX_FAILURES };
