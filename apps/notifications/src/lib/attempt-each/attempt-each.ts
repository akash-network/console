/** Attempts every item even when one fails, then rethrows the first failure so the caller is still retried. */
export async function attemptEach<T>(items: readonly T[], attempt: (item: T) => Promise<void>, onFailure: (item: T, error: unknown) => void): Promise<void> {
  const failures: unknown[] = [];

  for (const item of items) {
    try {
      await attempt(item);
    } catch (error) {
      failures.push(error);
      onFailure(item, error);
    }
  }

  if (failures.length) {
    throw failures[0];
  }
}
