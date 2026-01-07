import type { MiddlewareHandler } from "hono";

import type { LoggerService } from "../../services/logger/logger.service";

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
    cfRay?: string;
  };
  fingerprint?: string;
  userId?: string;
};

export class HttpLoggerInterceptor {
  constructor(private readonly logger?: LoggerService) {}

  intercept(): MiddlewareHandler {
    return async (c, next) => {
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
          log.httpRequest.cfRay = c.req.header("cf-ray");
          log.fingerprint = clientInfo.fingerprint;
        }

        if (currentUser) {
          log.userId = currentUser.id;
        }

        this.logger?.info(log);
      }
    };
  }
}
