import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { equalsInConstantTime, INTERNAL_TOKEN_HEADER } from "@src/middlewares/internal-token/internal-token.middleware";

export async function requirePrivateToken(c: Context, next: Next) {
  const secretToken = container.resolve(CORE_CONFIG).SECRET_TOKEN;
  const providedToken = c.req.header(INTERNAL_TOKEN_HEADER);

  if (!secretToken || providedToken === undefined || !equalsInConstantTime(providedToken, secretToken)) {
    return c.text("Unauthorized", 401);
  }

  await next();
}
