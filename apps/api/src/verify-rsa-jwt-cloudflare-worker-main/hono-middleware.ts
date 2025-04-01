import type { Context, MiddlewareHandler } from "hono";

import { getJwks } from "./get-jwks";
import { type GeneralKeyValueStore, useKVStore } from "./use-kv-store";
import { type VerificationResult, verify } from "./verify";

export type VerifyRsaJwtConfig = {
  jwksUri?: string;
  kvStore?: GeneralKeyValueStore;
  payloadValidator?: (payload: VerificationResult, ctx: Context) => void;
  verbose?: boolean;
  optional?: boolean;
};

const PAYLOAD_KEY = "verifyRsaJwtPayload";

export function verifyRsaJwt(config?: VerifyRsaJwtConfig): MiddlewareHandler {
  return async (ctx: Context, next) => {
    try {
      const jwtToken = ctx.req.header("Authorization")?.replace(/Bearer\s+/i, "");
      if (!jwtToken || jwtToken.length === 0) {
        throw new Error("JWT token not found in Authorization header");
      }

      const jwks = await getJwks(
        config?.jwksUri || ctx.env.JWKS_URI,
        useKVStore(config?.kvStore || ctx.env?.VERIFY_RSA_JWT),
        ctx.env?.VERIFY_RSA_JWT_JWKS_CACHE_KEY
      );
      const result = await verify(jwtToken, jwks);
      if (result.payload === null) {
        throw new Error("Invalid token");
      }

      // Custom validator that should throw an error if the payload is invalid.
      config?.payloadValidator?.(result, ctx);

      // Accessible payload.
      ctx.set(PAYLOAD_KEY, result.payload);
      await next();
    } catch (error) {
      config?.verbose && console.error({ message: "verification failed", error });

      if (config?.optional) {
        await next();
      } else {
        return new Response((error as Error).message, { status: 401 });
      }
    }
  };
}

export function getPayloadFromContext(ctx: Context) {
  return ctx.get(PAYLOAD_KEY);
}
