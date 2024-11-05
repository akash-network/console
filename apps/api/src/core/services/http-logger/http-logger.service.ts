import { LoggerService } from "@akashnetwork/logging";
import { Context, Next } from "hono";
import { singleton } from "tsyringe";

import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

@singleton()
export class HttpLoggerService implements HonoInterceptor {
  private readonly logger = new LoggerService({ context: "HTTP" });

  intercept() {
    return async (c: Context, next: Next) => {
      const timer = performance.now();

      await next();
      this.logger.info({
        httpRequest: {
          requestMethod: c.req.method,
          requestUrl: c.req.url,
          status: c.res.status,
          userAgent: c.req.header("user-agent"),
          referrer: c.req.raw.referrer,
          protocol: c.req.header("x-forwarded-proto"),
          duration: `${(performance.now() - timer).toFixed(3)}ms`
        }
      });
    };
  }
}
