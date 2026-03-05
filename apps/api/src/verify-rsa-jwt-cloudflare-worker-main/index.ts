import type { GeneralKeyValueStore, KVNamespaceOrKeyValueStore, KVStore } from "./use-kv-store";

export { getJwks } from "./get-jwks";
export type { Jwks } from "./get-jwks";
export { useKVStore } from "./use-kv-store";
export type { GeneralKeyValueStore, KVNamespaceOrKeyValueStore, KVStore };
export { verify } from "./verify";
export type { VerificationResult } from "./verify";

export type VerifyRsaJwtEnv = {
  VERIFY_RSA_JWT: KVNamespaceOrKeyValueStore;
  VERIFY_RSA_JWT_JWKS_CACHE_KEY: string;
  JWKS_URI: string;
};
