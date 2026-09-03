import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core/providers/config.provider";

function isAuthorized(c: Context, secretToken: string) {
  return c.req.query("token") === secretToken;
}

export async function privateMiddleware(c: Context, next: Next) {
  const secretToken = container.resolve(CORE_CONFIG).SECRET_TOKEN;

  if (secretToken && !isAuthorized(c, secretToken)) {
    return c.text("Unauthorized", 401);
  }

  await next();
}

/** An unset SECRET_TOKEN locks the route instead of opening it the way privateMiddleware does, so a deployment cannot publish it by omission. */
export async function requirePrivateToken(c: Context, next: Next) {
  const secretToken = container.resolve(CORE_CONFIG).SECRET_TOKEN;

  if (!secretToken || !isAuthorized(c, secretToken)) {
    return c.text("Unauthorized", 401);
  }

  await next();
}
