import { Context, Next } from "hono";
import { AsyncLocalStorage } from "node:async_hooks";
import { singleton } from "tsyringe";
import { v4 as uuid } from "uuid";

import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

@singleton()
export class RequestStorageService implements HonoInterceptor {
  private readonly CONTEXT_KEY = "CONTEXT";

  private readonly storage = new AsyncLocalStorage<Map<string, Context>>();

  get context() {
    return this.storage.getStore()?.get(this.CONTEXT_KEY);
  }

  intercept() {
    return async (c: Context, next: Next) => {
      const requestId = c.req.header("X-Request-Id") || uuid();
      c.set("requestId", requestId);

      await this.runWithContext(c, next);
    };
  }

  private async runWithContext(context: Context, cb: () => Promise<void>) {
    return await new Promise((resolve, reject) => {
      this.storage.run(new Map(), () => {
        this.storage.getStore().set(this.CONTEXT_KEY, context);
        cb().then(resolve).catch(reject);
      });
    });
  }
}
