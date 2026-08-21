/**
 * Shared retry/backoff/timeout plumbing for bulk Gmail write calls (actions, label apply, ...).
 * Firing a whole selection at Gmail in parallel produces "Too many concurrent requests for
 * user" — Gmail limits concurrency per user, so any bulk endpoint needs the same bounded
 * concurrency + 429 backoff or a chunk of a large selection silently fails.
 */

/** Per-request cap on a single Gmail call, so one stalled upstream request can't hold the
 * whole serverless invocation until the platform kills it. */
export const GMAIL_CALL_TIMEOUT_MS = 10_000;

/** fetch with a hard timeout, so a hung Gmail request fails fast and reports why. */
export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GMAIL_CALL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** How many of a batch's Gmail calls run at once. */
export const GMAIL_BATCH_CONCURRENCY = 5;
/** Kept low deliberately: callers typically abort the whole request well under a minute. */
export const GMAIL_RATE_LIMIT_RETRIES = 2;

/** Gmail signals rate limiting as 429, and as 403 with a rate-limit reason in the body. */
export function isRateLimited(status: number, body: string): boolean {
  if (status === 429) return true;
  return status === 403 && /rateLimitExceeded|userRateLimitExceeded|Too many concurrent requests/i.test(body);
}

/** Exponential backoff with jitter, so retried items in one batch don't resynchronise. */
export function backoffDelayMs(attempt: number): number {
  return 300 * 2 ** attempt + Math.floor(Math.random() * 150);
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
