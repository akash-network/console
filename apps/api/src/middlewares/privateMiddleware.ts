import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core/providers/config.provider";

export async function privateMiddleware(c: Context, next: Next) {
  const SECRET_TOKEN = container.resolve(CORE_CONFIG).SECRET_TOKEN;

  if (!SECRET_TOKEN) {
    await next();
  } else if (c.req.query("token") === SECRET_TOKEN) {
    await next();
  } else {
    return c.text("Unauthorized", 401);
  }
}
