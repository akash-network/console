import { LoggerService } from "@akashnetwork/logging";
import { differenceInSeconds } from "date-fns";

import MemoryCacheEngine from "./memoryCacheEngine";

const logger = LoggerService.forContext("Caching");

export const cacheEngine = new MemoryCacheEngine();
const pendingRequests: { [key: string]: Promise<unknown> } = {};

interface CachedObject<T> {
  date: Date;
  data: T;
}

interface MemoizeOptions {
  keepData?: boolean;
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
            .map(arg => (typeof arg === "string" ? arg : null))
            .filter(Boolean)
            .join("#")}`
        : cacheKey;

    return await cacheResponse(options?.ttlInSeconds || 60 * 2, argsKey, originalMethod.bind(this, ...args), options?.keepData);
  };
};

export async function cacheResponse<T>(seconds: number, key: string, refreshRequest: () => Promise<T>, keepData?: boolean): Promise<T> {
  const duration = seconds * 1000;
  const cachedObject = cacheEngine.getFromCache(key) as CachedObject<T> | undefined;
  logger.debug(`Request for key: ${key}`);

  // If first time or expired, must refresh data if not already refreshing
  const requiresRefresh = !cachedObject || Math.abs(differenceInSeconds(cachedObject.date, new Date())) > seconds;
  if (requiresRefresh && !(key in pendingRequests)) {
    logger.debug(`Object was not in cache or is expired, making new request for key: ${key}`);
    pendingRequests[key] = refreshRequest()
      .then(data => {
        cacheEngine.storeInCache(key, { date: new Date(), data: data }, keepData ? undefined : duration);
        return data;
      })
      .catch(err => {
        if (cachedObject) {
          logger.error({ message: `Error making cache request`, error: err });
        } else {
          throw err;
        }
      })
      .finally(() => {
        delete pendingRequests[key];
      });
  }

  // If there is data in cache, return it even if it is expired. Otherwise, wait for the refresh request to finish
  if (cachedObject) {
    logger.debug(`Returning cached object for key: ${key}`);
    return cachedObject.data;
  } else {
    logger.debug(`Waiting for pending request for key: ${key}`);
    return (await pendingRequests[key]) as T;
  }
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
