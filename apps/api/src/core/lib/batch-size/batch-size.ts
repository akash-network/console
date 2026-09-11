/** `LIMIT 0` reads as an empty fleet and ends a keyset scan silently, so a batch size is refused loudly before any query runs. */
export function assertBatchSize(batchSize: number): number {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`Batch size must be a positive integer, got ${batchSize}`);
  }

  return batchSize;
}
