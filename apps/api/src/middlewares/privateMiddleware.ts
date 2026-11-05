import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { equalsInConstantTime, INTERNAL_TOKEN_HEADER } from "@src/middlewares/internal-token/internal-token.middleware";

/** Still accepts the token from the query string until every caller sends the header, and reports each such caller. */
export async function requirePrivateToken(c: Context, next: Next) {
  const secretToken = container.resolve(CORE_CONFIG).SECRET_TOKEN;
  const headerToken = c.req.header(INTERNAL_TOKEN_HEADER);
  const providedToken = headerToken ?? c.req.query("token");

  if (!secretToken || providedToken === undefined || !equalsInConstantTime(providedToken, secretToken)) {
    return c.text("Unauthorized", 401);
  }

  if (headerToken === undefined) {
    reportQueryStringCaller(c);
  }

  await next();
}

function reportQueryStringCaller(c: Context) {
  const logger = container.resolve(LOGGER_FACTORY)({ context: "PrivateToken" });

  logger.warn({
    event: "PRIVATE_TOKEN_READ_FROM_QUERY_STRING",
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("user-agent")
  });
}
