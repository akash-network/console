import { Context, Next } from "hono";
import { AsyncLocalStorage } from "node:async_hooks";
import { singleton } from "tsyringe";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

@singleton()
export class RequestContextInterceptor implements HonoInterceptor {
  private readonly HTTP_CONTEXT_KEY = "HTTP_CONTEXT";

  private readonly storage = new AsyncLocalStorage<Map<string, Context>>();

  constructor(private readonly executionContextService: ExecutionContextService) {}

  intercept() {
    return async (c: Context, next: Next) => {
      await this.executionContextService.runWithContext(async () => {
        this.executionContextService.set(this.HTTP_CONTEXT_KEY, c);
        await next();
      });
    };
  }
}
