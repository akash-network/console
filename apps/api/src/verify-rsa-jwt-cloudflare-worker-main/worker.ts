import { getJwks, useKVStore, verify, VerifyRsaJwtEnv } from "./index";

export default {
  async fetch(request: Request, env: VerifyRsaJwtEnv): Promise<Response> {
    const token = request.headers.get("Authorization")?.replace(/Bearer\s+/i, "") || "";
    try {
      const jwks = await getJwks(env.JWKS_URI, useKVStore(env.VERIFY_RSA_JWT), env.VERIFY_RSA_JWT_JWKS_CACHE_KEY);
      const { payload } = await verify(token, jwks);
      // Then, you could validate the payload and return a response
      return new Response(JSON.stringify({ payload }), {
        headers: { "content-type": "application/json" }
      });
    } catch (error) {
      return new Response((error as Error).message, { status: 401 });
    }
  }
};
