import mcache from "memory-cache";

export default class MemoryCacheEngine {
  /**
   * Used to retrieve data from memcache
   * @param {*} key
   */
  getFromCache(key: string) {
    const cachedBody = mcache.get(key);
    if (cachedBody) {
      return cachedBody;
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
    mcache.put(key, data, duration);
  }
  /**
   * Used to delete all keys in a memcache
   */
  clearAllKeyInCache() {
    mcache.clear();
  }
  /**
   * Used to  delete specific key from memcache
   * @param {*} key
   */
  clearKeyInCache(key: string) {
    mcache.del(key);
  }
}
