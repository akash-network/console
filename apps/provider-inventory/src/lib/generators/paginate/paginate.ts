export interface Page<T> {
  items: T[];
  nextKey?: Uint8Array;
}

/**
 * Walks a cosmos-style key-paginated endpoint, yielding one page of items at a time.
 *
 * `fetchPage` is called with the previous page's `nextKey` (`undefined` for the first page)
 * and must return the page items along with the `nextKey` to continue from. Iteration stops
 * once a falsy or empty `nextKey` is returned, or when `signal` is aborted.
 *
 * Yielding page-by-page keeps only a single page in memory at once instead of accumulating the
 * full result set up front.
 */
export async function* paginate<T>(fetchPage: (key: Uint8Array | undefined) => Promise<Page<T>>, options: { signal?: AbortSignal } = {}): AsyncGenerator<T[]> {
  let nextKey: Uint8Array | undefined = undefined;
  do {
    const page = await fetchPage(nextKey);
    yield page.items;
    nextKey = page.nextKey;
  } while (nextKey && nextKey.length > 0 && !options.signal?.aborted);
}
