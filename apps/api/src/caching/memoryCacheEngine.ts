import { LRUCache } from "lru-cache";

export type CacheValue = NonNullable<unknown>;
const cache = new LRUCache<string, CacheValue>({ max: 500 });

export default class MemoryCacheEngine {
  getFromCache<T extends CacheValue>(key: string): T | undefined {
    return cache.get(key) as T | undefined;
  }

  storeInCache<T extends CacheValue>(key: string, data: T, durationInSeconds?: number) {
    cache.set(key, data, durationInSeconds ? { ttl: durationInSeconds * 1000 } : undefined);
  }

  /**
   * Used to delete all keys in a memcache
   */
  clearAllKeyInCache() {
    cache.clear();
  }

  /**
   * Used to delete specific key from memcache
   * @param {*} key
   */
  clearKeyInCache(key: string) {
    cache.delete(key);
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
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }

  /**
   * Used to get all keys in the cache
   */
  getKeys(): string[] {
    return [...cache.keys()];
  }
}
