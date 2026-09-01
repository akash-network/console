import { LRUCache } from "lru-cache";

export type CacheValue = NonNullable<unknown>;
const SHARED_MAX_ENTRIES = 500;
const sharedCache = new LRUCache<string, CacheValue>({ max: SHARED_MAX_ENTRIES });
const allCaches = new Set<LRUCache<string, CacheValue>>([sharedCache]);

export default class MemoryCacheEngine {
  readonly #cache: LRUCache<string, CacheValue>;

  /** Passing `maxEntries` gives the engine a private cache, so a high-cardinality key space cannot evict every other memoized response out of the shared one. */
  constructor(options?: { maxEntries: number }) {
    if (options) {
      this.#cache = new LRUCache<string, CacheValue>({ max: options.maxEntries });
      allCaches.add(this.#cache);
    } else {
      this.#cache = sharedCache;
    }
  }

  static clearAllCaches() {
    for (const cache of allCaches) {
      cache.clear();
    }
  }

  getFromCache<T extends CacheValue>(key: string): T | undefined {
    return this.#cache.get(key) as T | undefined;
  }

  storeInCache<T extends CacheValue>(key: string, data: T, durationInSeconds?: number) {
    this.#cache.set(key, data, durationInSeconds ? { ttl: durationInSeconds * 1000 } : undefined);
  }

  /**
   * Used to delete all keys in a memcache
   */
  clearAllKeyInCache() {
    this.#cache.clear();
  }

  /**
   * Used to delete specific key from memcache
   * @param {*} key
   */
  clearKeyInCache(key: string) {
    this.#cache.delete(key);
  }

  /**
   * Used to delete a specific key from memcache (alias for clearKeyInCache)
   * @param {*} key
   */
  clearByKey(key: string) {
    this.clearKeyInCache(key);
  }

  /**
   * Used to delete all keys that start with a specific prefix
   * @param {*} prefix
   */
  clearByPrefix(prefix: string) {
    for (const key of this.#cache.keys()) {
      if (key.startsWith(prefix)) {
        this.#cache.delete(key);
      }
    }
  }

  /**
   * Used to get all keys in the cache
   */
  getKeys(): string[] {
    return [...this.#cache.keys()];
  }
}
