import { LoggerService } from "@akashnetwork/logging";
import { Context, Next } from "hono";
import { singleton } from "tsyringe";

import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

type HttpRequestLog = {
  httpRequest: {
    requestMethod: string;
    requestUrl: string;
    status: number;
    userAgent?: string;
    referrer?: string;
    protocol?: string;
    remoteIp?: string;
    duration: string;
  };
  fingerprint?: string;
  userId?: string;
};

@singleton()
export class HttpLoggerService implements HonoInterceptor {
  private readonly logger = LoggerService.forContext("HTTP");

  intercept() {
    return async (c: Context, next: Next) => {
      const timer = performance.now();

      try {
        await next();
      } finally {
        const clientInfo = c.get("clientInfo");
        const currentUser = c.get("user");

        const log: HttpRequestLog = {
          httpRequest: {
            requestMethod: c.req.method,
            requestUrl: c.req.url,
            status: c.res.status,
            referrer: c.req.raw.referrer,
            protocol: c.req.header("x-forwarded-proto"),
            duration: `${(performance.now() - timer).toFixed(3)}ms`
          }
        };

        if (clientInfo) {
          log.httpRequest.userAgent = clientInfo.userAgent;
          log.httpRequest.remoteIp = clientInfo.ip;
          log.fingerprint = clientInfo.fingerprint;
        }

        if (currentUser) {
          log.userId = currentUser.id;
        }

        this.logger.info(log);
      }
    };
  }
}
