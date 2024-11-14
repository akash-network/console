import { Context, Next } from "hono";
import { singleton } from "tsyringe";

import { LoggerService } from "@src/core/services/logger/logger.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

@singleton()
export class HttpLoggerService implements HonoInterceptor {
  private readonly logger = LoggerService.forContext("HTTP");

  intercept() {
    return async (c: Context, next: Next) => {
      const timer = performance.now();
      this.logger.info({
        method: c.req.method,
        url: c.req.url
      });

      await next();

      this.logger.info({
        status: c.res.status,
        duration: `${(performance.now() - timer).toFixed(3)}ms`
      });
    };
  }
}
