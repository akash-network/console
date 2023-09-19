import { env } from "@src/utils/env";
import { expressjwt as jwt, GetVerificationKey, Request as JWTRequest } from "express-jwt";
import { expressJwtSecret } from "jwks-rsa";

export { JWTRequest };

const jwtSecret = expressJwtSecret({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: env.Auth0JWKSUri
}) as GetVerificationKey;

export const optionalUserMiddleware = jwt({
  secret: jwtSecret,
  audience: env.Auth0Audience,
  issuer: env.Auth0Issuer,
  algorithms: ["RS256"],
  credentialsRequired: false
});

export const requiredUserMiddleware = jwt({
  secret: jwtSecret,
  audience: env.Auth0Audience,
  issuer: env.Auth0Issuer,
  algorithms: ["RS256"],
  credentialsRequired: true
});
