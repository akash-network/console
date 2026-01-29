import { Context, Next } from "hono";
import { Forbidden } from "http-errors";
import { singleton } from "tsyringe";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@singleton()
export class BlockedUserInterceptor implements HonoInterceptor {
  constructor(private readonly executionContextService: ExecutionContextService) {}

  intercept() {
    return async (c: Context, next: Next) => {
      const currentUser = this.executionContextService.get("CURRENT_USER");

      if (currentUser?.isBlocked && !SAFE_METHODS.has(c.req.method)) {
        throw new Forbidden("User is blocked");
      }

      return await next();
    };
  }
}
