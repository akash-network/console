import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export interface Jwks {
  keys: Array<crypto.JsonWebKey & { kid?: string; alg?: string }>;
}

// Asymmetric algorithms accepted for vendor attestation tokens (EATs). HMAC is intentionally excluded.
const ALLOWED_ALGORITHMS: jwt.Algorithm[] = ["ES256", "ES384", "ES512", "RS256", "RS384", "RS512", "PS256", "PS384"];

/**
 * Verifies a vendor attestation token (EAT) against a JWKS: selects the signing key by `kid` (falling back to
 * the sole key only when the JWKS is unambiguous), imports the JWK via `node:crypto`, and checks the signature
 * with an allow-listed set of asymmetric algorithms. Throws on any failure so callers can treat the report as
 * `unverifiable`.
 */
export function verifyJwtWithJwks(token: string, jwks: Jwks): jwt.JwtPayload {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string") throw new Error("Malformed attestation token");

  // Match by `kid`; only fall back to a single sole key. With multiple keys and no `kid` match, picking
  // `keys[0]` would make verification depend on JWKS ordering, so fail on the ambiguity instead.
  const kid = decoded.header.kid;
  const jwk = (kid ? jwks.keys.find(key => key.kid === kid) : undefined) ?? (jwks.keys.length === 1 ? jwks.keys[0] : undefined);
  if (!jwk) throw new Error("No matching key in the vendor JWKS");

  const publicKeyPem = crypto.createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "pem" });
  const payload = jwt.verify(token, publicKeyPem, { algorithms: ALLOWED_ALGORITHMS });
  if (typeof payload === "string") throw new Error("Unexpected string payload in attestation token");
  return payload;
}
