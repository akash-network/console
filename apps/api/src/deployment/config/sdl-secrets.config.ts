import { protos } from "@google-cloud/kms";

const { CryptoKeyVersionAlgorithm } = protos.google.cloud.kms.v1.CryptoKeyVersion;

/** The JOSE name for the scheme Cloud KMS calls `RSA_DECRYPT_OAEP_*_SHA256`. */
export const SDL_SECRETS_SEAL_ALGORITHM = "RSA-OAEP-256";

const SEALING_KEY_ALGORITHM_NAMES = ["RSA_DECRYPT_OAEP_2048_SHA256", "RSA_DECRYPT_OAEP_3072_SHA256", "RSA_DECRYPT_OAEP_4096_SHA256"] as const;

/**
 * The Cloud KMS key algorithms that actually perform `RSA-OAEP-256`. A key version always decrypts
 * with its own configured algorithm, ignoring what a seal claims, so publishing this JWK for a key
 * provisioned outside this set would fail every unwrap instead of the request that misconfigured it.
 * Both encodings are listed because the API reports an enum as either its name or its ordinal.
 */
export const SDL_SECRETS_SEALING_KEY_ALGORITHMS: ReadonlySet<string | number> = new Set(
  SEALING_KEY_ALGORITHM_NAMES.flatMap(name => [name, CryptoKeyVersionAlgorithm[name]])
);

/** The only content encryption the console accepts for a seal. */
export const SDL_SECRETS_CONTENT_ENCRYPTION = "A256GCM";

/**
 * Claims a client must put in the protected header of a sealed payload. Advertised rather than
 * documented so that promoting a claim is a server-side change instead of a client release.
 */
export const SDL_SECRETS_REQUIRED_CLAIMS = ["kid", "sub", "exp"] as const;

/**
 * How far into the future a seal's `exp` may sit. Bounds how long a captured seal stays replayable,
 * with enough slack above the client's own lifetime to absorb clock skew.
 */
export const SDL_SECRETS_MAX_SEAL_LIFETIME_MS = 15 * 60 * 1000;
