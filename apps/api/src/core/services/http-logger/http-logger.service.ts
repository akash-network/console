import { Context, Next } from "hono";
import { singleton } from "tsyringe";

import { ContextualLoggerService } from "@src/core/services";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

@singleton()
export class HttpLoggerService implements HonoInterceptor {
  constructor(private readonly logger: ContextualLoggerService) {
    logger.setContext({ context: "HTTP" });
  }

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
