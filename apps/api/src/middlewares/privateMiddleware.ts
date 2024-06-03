import { Context, Next } from "hono";

import { env } from "@src/utils/env";

export async function privateMiddleware(c: Context, next: Next) {
  if (!env.SecretToken) {
    await next();
  } else if (c.req.query("token") === env.SecretToken) {
    await next();
  } else {
    return c.text("Unauthorized", 401);
  }
}
