import { KVStore } from "./use-kv-store";
export type Jwks = { keys: JsonWebKey[] };
const DEFAULT_JWK_CACHE_KEY = "verify-rsa-jwt-cloudflare-worker-jwks-cache-key";
export async function getJwks(jwksUri: string, kvStore: KVStore, jwkCacheKey?: string): Promise<Jwks> {
  if (!jwksUri) {
    throw new Error("No JWKS URI provided.");
  }
  try {
    new URL(jwksUri);
  } catch (error) {
    throw new Error("Invalid JWKS URI");
  }
  // Fetch the JWKs from KV or the JWKS URI
  const jwks = await kvStore.get<Jwks>(jwkCacheKey && jwkCacheKey.length > 0 ? jwkCacheKey : DEFAULT_JWK_CACHE_KEY, () => fetchJwks(jwksUri), validateJwks);
  return jwks;
}

async function fetchJwks(jwksUri: string): Promise<Jwks> {
  let response: Response;
  try {
    response = await fetch(jwksUri);
  } catch (e) {
    throw new Error("Failed to request on fetching JWKs: " + (e as Error).message);
  }
  if (!response.ok || !response.status.toString().startsWith("2")) {
    throw new Error("Failed to fetch JWKs: " + response.statusText);
  }
  const jwks: { keys: JsonWebKey[] } = await response.json();
  return jwks;
}

function validateJwks(value: unknown): value is Jwks {
  return value !== null && typeof value === "object" && "keys" in value && Array.isArray(value.keys);
}
