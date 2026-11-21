export interface VisitorReadCacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

interface CachedRead<T> {
  value: Promise<T>;
  expiresAt: number;
}

/**
 * Holds what the API answers a caller with no session, which is the same for every visitor, so a burst of crawlers costs one read.
 * Nothing read with a session may be put here. A failed read is forgotten at once.
 */
export class VisitorReadCache<T> {
  readonly #entries = new Map<string, CachedRead<T>>();
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;

  constructor(options: VisitorReadCacheOptions) {
    this.#ttlMs = options.ttlMs;
    this.#maxEntries = options.maxEntries;
    this.#now = options.now ?? Date.now;
  }

  read(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.#entries.get(key);
    if (cached && cached.expiresAt > this.#now()) return cached.value;

    const value = load();
    this.#entries.delete(key);
    this.#entries.set(key, { value, expiresAt: this.#now() + this.#ttlMs });
    this.#dropOldestBeyondLimit();
    value.catch(() => this.#forget(key, value));

    return value;
  }

  #forget(key: string, value: Promise<T>) {
    if (this.#entries.get(key)?.value === value) this.#entries.delete(key);
  }

  #dropOldestBeyondLimit() {
    while (this.#entries.size > this.#maxEntries) {
      const oldestKey = this.#entries.keys().next().value;
      if (oldestKey === undefined) return;
      this.#entries.delete(oldestKey);
    }
  }
}
