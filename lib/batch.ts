/**
 * Run `fn` over `items` with bounded concurrency: process in sequential batches of `size`, so at
 * most `size` operations (DB writes, HTTP calls) are ever in flight at once. This parallelizes
 * independent work without opening an unbounded number of connections — the middle ground between
 * a fully-serial `for await` loop (slow) and an unbounded `Promise.all` (can exhaust the DB pool).
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
  for (let start = 0; start < items.length; start += size) {
    const slice = items.slice(start, start + size);
    const settled = await Promise.all(slice.map((item, j) => fn(item, start + j)));
    for (let j = 0; j < settled.length; j++) results[start + j] = settled[j];
  }
  return results;
}
