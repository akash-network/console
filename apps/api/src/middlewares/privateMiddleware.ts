import { Context, Next } from "hono";

import { env } from "@src/utils/env";

export async function privateMiddleware(c: Context, next: Next) {
  if (!env.SECRET_TOKEN) {
    await next();
  } else if (c.req.query("token") === env.SECRET_TOKEN) {
    await next();
  } else {
    return c.text("Unauthorized", 401);
  }
}
