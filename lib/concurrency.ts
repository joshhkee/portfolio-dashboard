// Bounded-concurrency primitives.
//
// Two features fan out to Yahoo for many symbols at once (the positions
// table's sparklines, the correlation matrix). Their shared constraint is not
// throughput but politeness: a cold cache must not open twenty sockets to the
// same host in one tick. This lives on its own so neither feature has to
// import the other's module to get it.

/**
 * Run an async mapper with at most `limit` promises in flight, resolving to
 * results in the input order. Small enough not to justify a dependency.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
