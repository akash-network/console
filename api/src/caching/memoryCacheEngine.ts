import mcache from "memory-cache";

export default function MemoryCacheEngine() {}

/**
 * Used to retrieve data from memcache
 * @param {*} key
 */
MemoryCacheEngine.prototype.getFromCache = (key) => {
  const cachedBody = mcache.get(key);
  if (cachedBody) {
    return cachedBody;
  }
  return false;
};

/**
 * Used to store data in a memcache
 * @param {*} key
 * @param {*} data
 * @param {*} duration
 */
MemoryCacheEngine.prototype.storeInCache = (key, data, duration) => {
  mcache.put(key, data, duration);
};
/**
 * Used to delete all keys in a memcache
 */
MemoryCacheEngine.prototype.clearAllKeyInCache = () => {
  mcache.clear();
};
/**
 * Used to  delete specific key from memcache
 * @param {*} key
 */
 MemoryCacheEngine.prototype.clearAllKeyInCache = (key) => {
  mcache.del(key);
};