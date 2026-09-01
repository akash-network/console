import { LRUCache } from "lru-cache";

export type CacheValue = NonNullable<unknown>;

export interface CacheLimits {
  maxEntries?: number;
  maxTotalBytes?: number;
  maxEntryBytes?: number;
}

/** Bounding by entry count alone let multi-MB cached responses exhaust the 2GB V8 heap on 2026-09-01; bytes are the limit that matters. */
const DEFAULT_LIMITS = {
  maxEntries: 500,
  maxTotalBytes: 256 * 1024 * 1024,
  maxEntryBytes: 16 * 1024 * 1024
} satisfies Required<CacheLimits>;

/** Reads the holder instead of the replacer's argument because Buffer.toJSON has already expanded binary into `{ type, data }` by the time a replacer runs. */
export function estimateEntryBytes(value: CacheValue): number {
  let binaryBytes = 0;
  try {
    const json = JSON.stringify(value, function countBinaryOnce(this: Record<string, unknown>, key: string, nested: unknown) {
      const beforeToJson = this[key];
      if (beforeToJson instanceof Uint8Array) {
        binaryBytes += beforeToJson.byteLength;
        return undefined;
      }
      return typeof nested === "bigint" ? nested.toString() : nested;
    });
    return Buffer.byteLength(json ?? "", "utf8") + binaryBytes + 1;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function createBoundedCache(limits?: CacheLimits) {
  return new LRUCache<string, CacheValue>({
    max: limits?.maxEntries ?? DEFAULT_LIMITS.maxEntries,
    maxSize: limits?.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes,
    maxEntrySize: limits?.maxEntryBytes ?? DEFAULT_LIMITS.maxEntryBytes,
    sizeCalculation: estimateEntryBytes
  });
}

const sharedCache = createBoundedCache();
const allCaches = new Set<LRUCache<string, CacheValue>>([sharedCache]);

export default class MemoryCacheEngine {
  readonly #cache: LRUCache<string, CacheValue>;

  /** Passing limits gives the engine a private cache, so a high-cardinality key space cannot evict every other memoized response out of the shared one. */
  constructor(options?: CacheLimits) {
    if (options) {
      this.#cache = createBoundedCache(options);
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
