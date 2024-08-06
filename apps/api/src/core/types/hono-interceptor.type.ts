import type { MiddlewareHandler } from "hono";

export interface HonoInterceptor {
  intercept(options?: any): MiddlewareHandler;
}
