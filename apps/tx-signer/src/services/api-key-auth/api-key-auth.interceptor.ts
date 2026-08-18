import { createHash, timingSafeEqual } from "crypto";
import type { MiddlewareHandler } from "hono";
import { Unauthorized } from "http-errors";
import { singleton } from "tsyringe";

import { AppConfigService } from "@src/services/app-config/app-config.service";

@singleton()
export class ApiKeyAuthInterceptor {
  readonly #expectedKeyDigest: Buffer;

  constructor(config: AppConfigService) {
    this.#expectedKeyDigest = sha256(config.get("ACCESS_API_KEY"));
  }

  intercept(): MiddlewareHandler {
    return async (c, next) => {
      const providedKey = c.req.header("x-api-key");

      if (!providedKey || !timingSafeEqual(sha256(providedKey), this.#expectedKeyDigest)) {
        throw new Unauthorized("Invalid or missing API key");
      }

      await next();
    };
  }
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
