import { env } from "@src/utils/env";
import { verifyRsaJwt } from "../verify-rsa-jwt-cloudflare-worker-main";

export const requiredUserMiddleware = verifyRsaJwt({
  jwksUri: env.Auth0JWKSUri,
  verbose: true
});

export const optionalUserMiddleware = verifyRsaJwt({
  jwksUri: env.Auth0JWKSUri,
  optional: true
});
