import type { Context, Next } from "hono";
import assert from "http-assert";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";

export async function requireAuthentication(_c: Context, next: Next) {
  assert(container.resolve(AuthService).safeCurrentUser, 401);

  await next();
}
