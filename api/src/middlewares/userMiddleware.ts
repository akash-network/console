import { env } from "@src/utils/env";
import { getPayloadFromContext, verifyRsaJwt } from "../verify-rsa-jwt-cloudflare-worker-main";
import { Context } from "hono";
import { cacheEngine } from "@src/caching/helpers";

export const kvStore = {
  async get(key: string, format: string) {
    const result = cacheEngine.getFromCache(key);
    if (!result) {
      return null;
    } else if (format === "json") {
      return JSON.parse(result);
    } else {
      return cacheEngine.getFromCache(key);
    }
  },
  async put(key: string, value: any) {
    cacheEngine.storeInCache(key, value);
  }
};

export const requiredUserMiddleware = verifyRsaJwt({
  jwksUri: env.Auth0JWKSUri,
  kvStore: kvStore,
  verbose: true
});

export const optionalUserMiddleware = verifyRsaJwt({
  jwksUri: env.Auth0JWKSUri,
  kvStore: kvStore,
  optional: true
});

export function getCurrentUserId(c: Context) {
  const claims = getPayloadFromContext(c);
  return claims?.sub;
}
