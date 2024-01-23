import { env } from "@src/utils/env";
import {Context} from "hono";

export async function privateMiddleware(c: Context, next) {
  if (!env.SecretToken) {
    await next();
  } else if (c.req.query("token") === env.SecretToken) {
    await next();
  } else {
    return c.text("Unauthorized", 401);
  }

}
