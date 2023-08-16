import { differenceInSeconds } from "date-fns";
import MemoryCacheEngine from "./memoryCacheEngine";
import * as Sentry from "@sentry/node";

const cacheEngine = new MemoryCacheEngine();
const pendingRequests: { [key: string]: Promise<any> } = {};

interface CachedObject {
  date: Date;
  data: any;
}

export const cacheResponse = async (seconds: number, key: string, refreshRequest: () => Promise<any>, keepData?: boolean): Promise<any> => {
  const duration = seconds * 1000;
  const cachedObject = cacheEngine.getFromCache(key) as CachedObject;

  console.log(`Cache key: ${key}`);

  // If first time or expired, must refresh data if not already refreshing
  const cacheExpired = Math.abs(differenceInSeconds(cachedObject?.date, new Date())) > seconds;
  if ((!cachedObject || cacheExpired) && !(key in pendingRequests)) {
    console.log(`Making request: ${key}`);
    pendingRequests[key] = refreshRequest()
      .then((data) => {
        cacheEngine.storeInCache(key, { date: new Date(), data: data }, keepData ? undefined : duration);
        return data;
      })
      .catch((err) => {
        console.log(`Error making cache request ${err}`);
        Sentry.captureException(err);
      })
      .finally(() => {
        delete pendingRequests[key];
      });
  }

  // If there is data in cache, return it even if it is expired. Otherwise, wait for the refresh request to finish
  if (cachedObject) {
    console.log(`Cache hit: ${key}`);
    return cachedObject.data;
  } else {
    console.log(`Waiting for pending request: ${key}`);
    return await pendingRequests[key];
  }
};

export const cacheKeys = {
  getProviderGraphData: "getProviderGraphData",
  web3IndexRevenue: "web3IndexRevenue",
  getProviderActiveLeasesGraphData: "getProviderActiveLeasesGraphData",
  getProviderAttributesSchema: "getProviderAttributesSchema",
  getTemplates: "getTemplates",
  getAuditors: "getAuditors",
  getChainStats: "getChainStats",
  getMainnetNodes: "getMainnetNodes",
  getTestnetNodes: "getTestnetNodes",
  getSandboxNodes: "getSandboxNodes",
  getMainnetVersion: "getMainnetVersion",
  getTestnetVersion: "getTestnetVersion",
  getSandboxVersion: "getSandboxVersion",
};
