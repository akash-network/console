import { createOtelLogger } from "@akashnetwork/logging/otel";
import { LRUCache } from "lru-cache";

import type { CacheLimits } from "./cache-registry";
import { cacheRegistry, NOMINAL_ENTRY_BYTES } from "./cache-registry";

export type CacheValue = NonNullable<unknown>;

/** Multi-MB cached responses exhausted the 2GB V8 heap on 2026-09-01; the byte ceilings bound entries stored with an explicit size. */
const DEFAULT_LIMITS = {
  maxEntries: 500,
  maxTotalBytes: 256 * 1024 * 1024,
  maxEntryBytes: 16 * 1024 * 1024
} satisfies Required<CacheLimits>;

const MAX_WARNED_OVERSIZED_KEYS = 1000;

const logger = createOtelLogger({ context: "Caching" });

function resolveLimits(limits?: CacheLimits): Required<CacheLimits> {
  return {
    maxEntries: limits?.maxEntries ?? DEFAULT_LIMITS.maxEntries,
    maxTotalBytes: limits?.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes,
    maxEntryBytes: limits?.maxEntryBytes ?? DEFAULT_LIMITS.maxEntryBytes
  };
}

function createBoundedCache(limits: Required<CacheLimits>) {
  return new LRUCache<string, CacheValue>({
    max: limits.maxEntries,
    maxSize: limits.maxTotalBytes,
    maxEntrySize: limits.maxEntryBytes,
    sizeCalculation: () => NOMINAL_ENTRY_BYTES
  });
}

const sharedLimits = resolveLimits();
const sharedCache = createBoundedCache(sharedLimits);
cacheRegistry.register("shared", sharedCache);

export default class MemoryCacheEngine {
  readonly #cache: LRUCache<string, CacheValue>;
  readonly #limits: Required<CacheLimits>;
  readonly #warnedOversizedKeys = new Set<string>();

  /** Passing limits gives the engine a private cache, so a high-cardinality key space cannot evict every other memoized response out of the shared one. */
  constructor(options?: CacheLimits & { name?: string }) {
    if (options) {
      this.#limits = resolveLimits(options);
      this.#cache = createBoundedCache(this.#limits);
      cacheRegistry.register(options.name ?? "private", this.#cache);
    } else {
      this.#limits = sharedLimits;
      this.#cache = sharedCache;
    }
  }

  static clearAllCaches() {
    cacheRegistry.clearAll();
  }

  getFromCache<T extends CacheValue>(key: string): T | undefined {
    return this.#cache.get(key) as T | undefined;
  }

  storeInCache<T extends CacheValue>(key: string, data: T, durationInSeconds?: number, sizeBytes?: number) {
    if (sizeBytes !== undefined && sizeBytes > this.#limits.maxEntryBytes) {
      this.#warnOversizedEntry(key, sizeBytes);
      return;
    }

    this.#cache.set(key, data, {
      ttl: durationInSeconds ? durationInSeconds * 1000 : undefined,
      size: sizeBytes
    });
  }

  #warnOversizedEntry(key: string, sizeBytes: number) {
    if (this.#warnedOversizedKeys.has(key)) return;
    if (this.#warnedOversizedKeys.size >= MAX_WARNED_OVERSIZED_KEYS) {
      this.#warnedOversizedKeys.clear();
    }
    this.#warnedOversizedKeys.add(key);
    logger.warn({ event: "CACHE_ENTRY_TOO_LARGE", key, sizeBytes, maxEntryBytes: this.#limits.maxEntryBytes });
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
