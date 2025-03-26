import { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

import { ClientInfoContextVariables } from "@src/middlewares/clientInfoMiddleware";
import { envConfig } from "../config/env.config";

export const rateLimit = (options: RateLimitOptions) => {
  if (!envConfig.ENABLE_RATE_LIMITER) return;
  return rateLimiter<{ Variables: ClientInfoContextVariables }>({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-6",
    keyGenerator: options.generateKey
  });
};

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  generateKey: (c: Context<{ Variables: ClientInfoContextVariables }>) => string | Promise<string>;
}

export const clientIdentity = {
  byIp: c => c.get("clientInfo")?.ip
} satisfies Record<string, RateLimitOptions["generateKey"]>;
