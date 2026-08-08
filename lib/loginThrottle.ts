/**
 * Minimal in-memory brute-force throttle for the credentials login flow.
 *
 * Single-process only (state lives in a module-level Map) — which matches this
 * app's single-instance deployment. For a scaled-out deployment this should be
 * backed by Redis or a shared store, mirroring the events.ts note.
 */

interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil?: number;
}

const WINDOW_MS = 15 * 60 * 1000; // failures counted within a rolling window
const MAX_FAILURES = 5; // failures before a lockout kicks in
const BLOCK_MS = 15 * 60 * 1000; // lockout duration once tripped

const attempts = new Map<string, Attempt>();

/** Normalize so case/whitespace variations can't sidestep the counter. */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function isRateLimited(email: string): boolean {
  const a = attempts.get(normalize(email));
  return !!a?.blockedUntil && a.blockedUntil > Date.now();
}

export function recordFailure(email: string): void {
  const key = normalize(email);
  const now = Date.now();
  const a = attempts.get(key);

  if (!a || now - a.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }

  a.count += 1;
  if (a.count >= MAX_FAILURES) {
    a.blockedUntil = now + BLOCK_MS;
  }
}

export function recordSuccess(email: string): void {
  attempts.delete(normalize(email));
}
