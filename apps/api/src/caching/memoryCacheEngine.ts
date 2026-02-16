import { LRUCache } from "lru-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new LRUCache<string, any>({ max: 500 });

export default class MemoryCacheEngine {
  /**
   * Used to retrieve data from memcache
   * @param {*} key
   */
  getFromCache<T>(key: string): T | false {
    const cachedBody = cache.get(key);
    if (cachedBody !== undefined) {
      return cachedBody as T;
    }
    return false;
  }

  /**
   * Used to store data in a memcache
   * @param {*} key
   * @param {*} data
   * @param {*} duration
   */
  storeInCache<T>(key: string, data: T, duration?: number) {
    cache.set(key, data, duration ? { ttl: duration } : undefined);
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
