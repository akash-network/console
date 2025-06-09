import { singleton } from "tsyringe";

import { kvStore } from "@src/middlewares/userMiddleware";
import { env } from "@src/utils/env";
import { getJwks, useKVStore, verify, VerifyRsaJwtEnv } from "@src/verify-rsa-jwt-cloudflare-worker-main";

@singleton()
export class UserAuthTokenService {
  async getValidUserId(bearer: string, options?: VerifyRsaJwtEnv) {
    const token = bearer.replace(/^Bearer\s+/i, "");
    const jwksUri = env.AUTH0_JWKS_URI || options?.JWKS_URI;

    if (!jwksUri) {
      throw new Error("Environment variable AUTH0_JWKS_URI is not set and options.JWKS_URI is not provided");
    }

    const jwks = await getJwks(jwksUri, useKVStore(kvStore || options?.VERIFY_RSA_JWT), options?.VERIFY_RSA_JWT_JWKS_CACHE_KEY);
    const result = await verify(token, jwks);

    return (result.payload as { sub: string }).sub;
  }
}
