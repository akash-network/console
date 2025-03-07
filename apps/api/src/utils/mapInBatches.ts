/**
 * Calls callback `options.batchSize` times in parallel for every item in array sequentially.
 * This is useful for rate limiting requests to external services.
 *
 * @returns an array of mapped results
 */
export async function mapInBatches<T, U>(items: T[], callback: (item: T, index: number) => Promise<U>, options?: MapInBatchesOptions): Promise<U[]> {
  const results: U[] = [];
  let index = 0;
  const workers = Array.from({ length: options?.batchSize ?? 5 }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await callback(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
}

export interface MapInBatchesOptions {
  batchSize?: number;
}
