/**
 * Run `fn` over `items` with at most `size` operations (DB writes, HTTP calls) in flight at once.
 * The middle ground between a fully-serial loop (slow) and an unbounded `Promise.all` (exhausts
 * connection pools and trips per-user API rate limits).
 *
 * Implemented as a worker pool rather than sequential batches: `size` workers pull from a shared
 * cursor, so a slow item never leaves the other slots idle waiting for its batch to finish. With
 * batches, one slow call among ten stalled the other nine — on a page of Gmail messages that turned
 * a handful of slow fetches into several seconds of mostly-idle waiting.
 *
 * Results are returned in input order. Only use this when the operations are genuinely independent
 * (no ordering dependency between writes); a throw from any item rejects the whole call.
 */
export async function mapInBatches<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  size = 10
): Promise<R[]> {
  if (size < 1) throw new Error("mapInBatches: size must be >= 1");
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    })
  );
  return results;
}
