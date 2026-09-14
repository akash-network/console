import { createHash, timingSafeEqual } from "crypto";
import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core/providers/config.provider";

export const INTERNAL_TOKEN_HEADER = "x-console-internal-token";

/** Fails closed when the token is unset, and takes the token from a header rather than the query string. */
export async function requireInternalToken(c: Context, next: Next) {
  const expected = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const provided = c.req.header(INTERNAL_TOKEN_HEADER);

  if (!expected || !provided || !equalsInConstantTime(provided, expected)) {
    return c.text("Unauthorized", 401);
  }

  await next();
}

/** Digests are compared so the comparison stays constant time across inputs of differing length. */
function equalsInConstantTime(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
