import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { IDENTITY_HEADERS } from "@src/interfaces/rest/services/auth/request-identity";

@Injectable()
export class LocalHttpLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = performance.now();

    response.on("finish", () => {
      const log = {
        httpRequest: {
          requestMethod: request.method,
          requestUrl: request.url,
          status: response.statusCode,
          referrer: request.get("referrer"),
          protocol: request.headers["x-forwarded-proto"],
          duration: `${(performance.now() - startTime).toFixed(3)}ms`
        },
        userId: request.headers[IDENTITY_HEADERS.userId],
        organizationId: request.headers[IDENTITY_HEADERS.organizationId] ?? null
      };

      this.logger.info(log);
    });

    next();
  }
}
