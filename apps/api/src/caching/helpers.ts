import { createOtelLogger } from "@akashnetwork/logging/otel";
import { differenceInSeconds } from "date-fns";
import { LRUCache } from "lru-cache";

import { cacheRegistry } from "./cache-registry";
import MemoryCacheEngine from "./memoryCacheEngine";

const logger = createOtelLogger({ context: "Caching" });

/** Covers the `{date, data}` wrapper around a payload whose byte size is known exactly. */
const EXPLICIT_SIZE_WRAPPER_OVERHEAD_BYTES = 64;

function getExplicitSizeBytes(data: unknown): number | undefined {
  if (data instanceof Uint8Array) return data.byteLength + EXPLICIT_SIZE_WRAPPER_OVERHEAD_BYTES;
  if (typeof data === "string") return Buffer.byteLength(data, "utf8") + EXPLICIT_SIZE_WRAPPER_OVERHEAD_BYTES;
  return undefined;
}

export const cacheEngine = new MemoryCacheEngine();
const pendingRequests = new Map<string, Promise<unknown>>();

interface CachedObject<T> {
  date: Date;
  data: T;
}

interface MemoizeOptions {
  ttlInSeconds?: number;
  key?: string;
  /** Set on methods whose arguments form an unbounded key space, to cap them in a private cache instead of letting them evict the shared one. */
  maxEntries?: number;
}

export const Memoize = (options?: MemoizeOptions) => (target: object, propertyName: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  const cacheKey = options?.key || `${target.constructor.name}#${propertyName}`;
  const store = options?.maxEntries ? new MemoryCacheEngine({ maxEntries: options.maxEntries, name: cacheKey }) : cacheEngine;

  descriptor.value = async function memoizedFunction(...args: unknown[]) {
    const argsKey =
      args.length > 0
        ? `${cacheKey}#${args
            .map(arg => (["string", "number", "boolean"].includes(typeof arg) ? String(arg) : null))
            .filter(Boolean)
            .join("#")}`
        : cacheKey;

    return cacheResponse(options?.ttlInSeconds || 60 * 2, argsKey, originalMethod.bind(this, ...args), store);
  };
};

export async function cacheResponse<T>(seconds: number, key: string, refreshRequest: () => Promise<T>, store: MemoryCacheEngine = cacheEngine): Promise<T> {
  const cachedObject = store.getFromCache<CachedObject<T>>(key);
  logger.debug(`Request for key: ${key}`);

  const hasCachedData = cachedObject !== undefined;

  // Check if cached data is still valid (only if we have cached data)
  let isExpired = true;
  if (hasCachedData) {
    const timeDiff = differenceInSeconds(new Date(), cachedObject.date);
    isExpired = timeDiff >= seconds;
  }

  // If we have cached data (valid or expired), return it immediately
  if (hasCachedData) {
    logger.debug(`Returning cached object for key: ${key} (expired: ${isExpired})`);

    // If data is expired and there's no pending request, start background refresh
    if (isExpired && !pendingRequests.has(key)) {
      logger.debug(`Starting background refresh for key: ${key}`);

      // Start background refresh
      const pendingRequest = refreshRequest()
        .then(data => {
          logger.debug(`Background refresh completed for key: ${key}`);
          // Only store in cache if we have valid data
          if (data !== undefined) {
            store.storeInCache(key, { date: new Date(), data: data }, undefined, getExplicitSizeBytes(data));
          }
          return data;
        })
        .catch(err => {
          logger.error({ message: `Error making background cache refresh`, error: err });
          // Return the current cached data on error to maintain consistency
          return cachedObject.data;
        })
        .finally(() => {
          pendingRequests.delete(key);
          logger.debug(`Removed pending request for key: ${key}`);
        });

      pendingRequests.set(key, pendingRequest);
    }

    // Return the cached data immediately (whether valid or expired)
    return cachedObject.data;
  }

  // If no cached data exists, make the request and wait for it
  logger.debug(`No cached data, making new request for key: ${key}`);

  // Get or create the pending request promise
  let pendingRequest = pendingRequests.get(key) as Promise<T> | undefined;
  if (!pendingRequest) {
    pendingRequest = refreshRequest()
      .then(data => {
        logger.debug(`New request completed for key: ${key}`);
        // Only store in cache if we have valid data
        if (data !== undefined) {
          store.storeInCache(key, { date: new Date(), data: data }, undefined, getExplicitSizeBytes(data));
        }
        return data;
      })
      .finally(() => {
        pendingRequests.delete(key);
        logger.debug(`Removed pending request for key: ${key}`);
      });

    pendingRequests.set(key, pendingRequest);
  }

  return await pendingRequest;
}

export function memoizeAsync<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  options?: {
    cacheItemLimit?: number;
    ttl?: number;
    getCacheKey?: (...args: A) => string;
    name?: string;
  }
): (...args: A) => Promise<R> {
  const cache = new LRUCache<string, Promise<R>>({ max: options?.cacheItemLimit ?? 100, ttl: options?.ttl });
  cacheRegistry.register(options?.name || fn.name || "memoizeAsync", cache);

  return (...args: A) => {
    const key = options?.getCacheKey ? options.getCacheKey(...args) : JSON.stringify(args);

    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const promise = fn(...args);

    promise.catch(() => {
      cache.delete(key);
    });

    cache.set(key, promise);
    return promise;
  };
}

export const cacheKeys = {
  getProviderGraphData: "getProviderGraphData",
  web3IndexRevenue: "web3IndexRevenue",
  getProviderActiveLeasesGraphData: "getProviderActiveLeasesGraphData",
  getTemplates: "getTemplates",
  getMarketData: "getMarketData",
  getProviderListJson: "getProviderListJson",
  getTrialProviderListJson: "getTrialProviderListJson",
  getTrialRegisteredProviderList: "getTrialRegisteredProviderList",
  getChainStats: "getChainStats",
  getGpuModels: "getGpuModels",
  getTrialProviders: "getTrialProviders",
  getGpuUtilization: "getGpuUtilization",
  getGpuBreakdown: "getGpuBreakdown",
  getProviderListGzipped: "getProviderListGzipped",
  getTrialProviderListGzipped: "getTrialProviderListGzipped"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reusePendingPromise<T extends (...args: any[]) => Promise<unknown>>(fn: T, options?: { getKey?: (...args: Parameters<T>) => string }): T {
  const pendingPromises = new Map<string, Promise<unknown>>();

  return ((...args: Parameters<T>) => {
    const key = options?.getKey ? options.getKey(...args) : JSON.stringify(args);

    let pendingPromise = pendingPromises.get(key);
    if (!pendingPromise) {
      pendingPromise = fn(...args).finally(() => pendingPromises.delete(key)) as ReturnType<T>;
      pendingPromises.set(key, pendingPromise);
    }

    return pendingPromise as ReturnType<T>;
  }) as unknown as T;
}
