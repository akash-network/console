import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { LoggerService } from "@src/common/services/logger/logger.service";

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
        userId: request.headers["x-user-id"]
      };

      this.logger.info(log);
    });

    next();
  }
}
