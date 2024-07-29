import { Context, Next } from "hono";
import { singleton } from "tsyringe";

import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";
import { getCurrentUserId } from "@src/middlewares/userMiddleware";

export const CURRENT_USER = "CURRENT_USER";

@singleton()
export class CurrentUserInterceptor implements HonoInterceptor {
  intercept() {
    return async (c: Context, next: Next) => {
      const userId = getCurrentUserId(c);
      c.set(CURRENT_USER, { userId, isAnonymous: !userId });

      return await next();
    };
  }
}
