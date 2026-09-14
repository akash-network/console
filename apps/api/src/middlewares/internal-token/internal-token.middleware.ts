import { createHash, timingSafeEqual } from "crypto";
import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core/providers/config.provider";

export const INTERNAL_TOKEN_HEADER = "x-console-internal-token";

/**
 * Guards a route called by internal callers outside this cluster, so unlike privateMiddleware it fails closed on
 * an unset token and reads a header rather than a query parameter that would land in every access log it passes.
 */
export async function requireInternalToken(c: Context, next: Next) {
  const expected = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const provided = c.req.header(INTERNAL_TOKEN_HEADER);

  if (!expected || !provided || !equalsInConstantTime(provided, expected)) {
    return c.text("Unauthorized", 401);
  }

  await next();
}

/** Compares digests rather than the tokens themselves, so the fixed digest length leaks nothing about the token's. */
function equalsInConstantTime(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
