import { env } from "@src/utils/env";
import { getPayloadFromContext, verifyRsaJwt } from "../verify-rsa-jwt-cloudflare-worker-main";
import { Context } from "hono";

export const requiredUserMiddleware = verifyRsaJwt({
  jwksUri: env.Auth0JWKSUri,
  verbose: true
});

export const optionalUserMiddleware = verifyRsaJwt({
  jwksUri: env.Auth0JWKSUri,
  optional: true
});

export function getCurrentUserId(c: Context) {
  const claims = getPayloadFromContext(c);
  return claims?.sub;
}
