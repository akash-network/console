import { createOtelLogger } from "@akashnetwork/logging/otel";
import { differenceInSeconds } from "date-fns";
import { LRUCache } from "lru-cache";

import { cacheRegistry, nominalEntrySizing } from "./cache-registry";
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

const MAX_STALE_WINDOW_SECONDS = 5 * 60;

function getMaxAgeInSeconds(ttlInSeconds: number) {
  return ttlInSeconds + Math.min(ttlInSeconds, MAX_STALE_WINDOW_SECONDS);
}

/** Past its max age an entry counts as missing: callers wait for the refresh and get its error if it fails, as on an empty cache. */
export async function cacheResponse<T>(seconds: number, key: string, refreshRequest: () => Promise<T>, store: MemoryCacheEngine = cacheEngine): Promise<T> {
  const cachedObject = store.getFromCache<CachedObject<T>>(key);
  logger.debug(`Request for key: ${key}`);

  if (cachedObject === undefined) {
    logger.debug(`No cached data, making new request for key: ${key}`);
    return await getOrStartRefresh(key, refreshRequest, store);
  }

  const ageInSeconds = differenceInSeconds(new Date(), cachedObject.date);

  if (ageInSeconds >= getMaxAgeInSeconds(seconds)) {
    logger.debug(`Cached object past its max age, waiting for a refresh for key: ${key}`);
    return await getOrStartRefresh(key, refreshRequest, store);
  }

  if (ageInSeconds >= seconds && !pendingRequests.has(key)) {
    logger.debug(`Starting background refresh for key: ${key}`);
    getOrStartRefresh(key, refreshRequest, store).catch(error => logger.error({ message: `Error making background cache refresh`, error }));
  }

  return cachedObject.data;
}

function getOrStartRefresh<T>(key: string, refreshRequest: () => Promise<T>, store: MemoryCacheEngine): Promise<T> {
  const pendingRequest = pendingRequests.get(key) as Promise<T> | undefined;
  if (pendingRequest) return pendingRequest;

  const request = refreshRequest()
    .then(data => {
      logger.debug(`Refresh completed for key: ${key}`);
      if (data !== undefined) {
        store.storeInCache(key, { date: new Date(), data }, undefined, getExplicitSizeBytes(data));
      }
      return data;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });
  pendingRequests.set(key, request);

  return request;
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
  const maxEntries = options?.cacheItemLimit ?? 100;
  const cache = new LRUCache<string, Promise<R>>({ max: maxEntries, ttl: options?.ttl, ...nominalEntrySizing(maxEntries) });
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
