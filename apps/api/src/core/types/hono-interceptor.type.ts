import type { MiddlewareHandler } from "hono";

export interface HonoInterceptor {
  intercept(): MiddlewareHandler;
}
