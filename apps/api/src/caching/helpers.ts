import { createOtelLogger } from "@akashnetwork/logging/otel";
import { differenceInSeconds } from "date-fns";

import MemoryCacheEngine from "./memoryCacheEngine";

const logger = createOtelLogger({ context: "Caching" });

export const cacheEngine = new MemoryCacheEngine();
const pendingRequests = new Map<string, Promise<unknown>>();

interface CachedObject<T> {
  date: Date;
  data: T;
}

interface MemoizeOptions {
  ttlInSeconds?: number;
  key?: string;
}

export const Memoize = (options?: MemoizeOptions) => (target: object, propertyName: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  const cacheKey = options?.key || `${target.constructor.name}#${propertyName}`;

  descriptor.value = async function memoizedFunction(...args: unknown[]) {
    const argsKey =
      args.length > 0
        ? `${cacheKey}#${args
            .map(arg => (["string", "number"].includes(typeof arg) ? String(arg) : null))
            .filter(Boolean)
            .join("#")}`
        : cacheKey;

    return cacheResponse(options?.ttlInSeconds || 60 * 2, argsKey, originalMethod.bind(this, ...args));
  };
};

export async function cacheResponse<T>(seconds: number, key: string, refreshRequest: () => Promise<T>): Promise<T> {
  const cachedObject = cacheEngine.getFromCache<CachedObject<T>>(key);
  logger.debug(`Request for key: ${key}`);

  const hasCachedData = cachedObject !== false;

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
            cacheEngine.storeInCache(key, { date: new Date(), data: data });
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
          cacheEngine.storeInCache(key, { date: new Date(), data: data });
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

export function memoizeAsync<T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);

    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const promise = fn(...args) as ReturnType<T>;

    promise.catch(() => {
      cache.delete(key);
    });

    cache.set(key, promise);
    return promise;
  }) as unknown as T;
}

export const cacheKeys = {
  getProviderGraphData: "getProviderGraphData",
  web3IndexRevenue: "web3IndexRevenue",
  getProviderActiveLeasesGraphData: "getProviderActiveLeasesGraphData",
  getTemplates: "getTemplates",
  getMarketData: "getMarketData",
  getProviderList: "getProviderList",
  getTrialProviderList: "getTrialProviderList",
  getTrialRegisteredProviderList: "getTrialRegisteredProviderList",
  getChainStats: "getChainStats",
  getGpuModels: "getGpuModels",
  getTrialProviders: "getTrialProviders",
  getGpuUtilization: "getGpuUtilization",
  getGpuBreakdown: "getGpuBreakdown"
};
