import { differenceInSeconds } from "date-fns";
import MemoryCacheEngine from "./memoryCacheEngine";
import * as Sentry from "@sentry/node";

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
    return await cacheResponse(options?.ttlInSeconds || 60 * 2, cacheKey, originalMethod.bind(this, ...args), options?.keepData);
  };
};

export async function cacheResponse<T>(seconds: number, key: string, refreshRequest: () => Promise<T>, keepData?: boolean): Promise<T> {
  const duration = seconds * 1000;
  const cachedObject = cacheEngine.getFromCache(key) as CachedObject<T> | undefined;
  // console.log(`Cache key: ${key}`);

  // If first time or expired, must refresh data if not already refreshing
  const cacheExpired = Math.abs(differenceInSeconds(cachedObject?.date, new Date())) > seconds;
  if ((!cachedObject || cacheExpired) && !(key in pendingRequests)) {
    // console.log(`Making request: ${key}`);
    pendingRequests[key] = refreshRequest()
      .then((data) => {
        cacheEngine.storeInCache(key, { date: new Date(), data: data }, keepData ? undefined : duration);
        return data;
      })
      .catch((err) => {
        // console.log(`Error making cache request ${err}`);
        Sentry.captureException(err);
      })
      .finally(() => {
        delete pendingRequests[key];
      });
  }

  // If there is data in cache, return it even if it is expired. Otherwise, wait for the refresh request to finish
  if (cachedObject) {
    // console.log(`Cache hit: ${key}`);
    return cachedObject.data;
  } else {
    // console.log(`Waiting for pending request: ${key}`);
    return (await pendingRequests[key]) as T;
  }
}

export const cacheKeys = {
  getProviderGraphData: "getProviderGraphData",
  web3IndexRevenue: "web3IndexRevenue",
  getProviderActiveLeasesGraphData: "getProviderActiveLeasesGraphData",
  getProviderAttributesSchema: "getProviderAttributesSchema",
  getTemplates: "getTemplates",
  getMarketData: "getMarketData",
  getAuditors: "getAuditors",
  getProviderList: "getProviderList",
  getChainStats: "getChainStats",
  getProviderRegions: "getProviderRegions",
  getMainnetNodes: "getMainnetNodes",
  getTestnetNodes: "getTestnetNodes",
  getSandboxNodes: "getSandboxNodes",
  getMainnetVersion: "getMainnetVersion",
  getTestnetVersion: "getTestnetVersion",
  getSandboxVersion: "getSandboxVersion",
  getGpuModels: "getGpuModels"
};
