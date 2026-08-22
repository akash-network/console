import { protos } from "@google-cloud/kms";

const { CryptoKeyVersionAlgorithm } = protos.google.cloud.kms.v1.CryptoKeyVersion;

/** The JOSE name for the scheme Cloud KMS calls `RSA_DECRYPT_OAEP_*_SHA256`. */
export const SDL_SECRETS_SEAL_ALGORITHM = "RSA-OAEP-256";

const SEALING_KEY_MODULUS_BITS = [2048, 3072, 4096] as const;

const SEALING_KEY_ALGORITHM_NAMES = SEALING_KEY_MODULUS_BITS.map(bits => `RSA_DECRYPT_OAEP_${bits}_SHA256` as const);

/**
 * The Cloud KMS key algorithms that actually perform `RSA-OAEP-256`. A key version always decrypts
 * with its own configured algorithm, ignoring what a seal claims, so publishing this JWK for a key
 * provisioned outside this set would fail every unwrap instead of the request that misconfigured it.
 * Both encodings are listed because the API reports an enum as either its name or its ordinal.
 */
export const SDL_SECRETS_SEALING_KEY_ALGORITHMS: ReadonlySet<string | number> = new Set(
  SEALING_KEY_ALGORITHM_NAMES.flatMap(name => [name, CryptoKeyVersionAlgorithm[name]])
);

/**
 * Byte lengths a wrapped content encryption key may have. RSA ciphertext is always exactly the
 * modulus size, so measuring it locally keeps a garbage encrypted key from spending an unwrap and
 * being reported as a Cloud KMS fault.
 */
export const SDL_SECRETS_WRAPPED_KEY_BYTES: ReadonlySet<number> = new Set(SEALING_KEY_MODULUS_BITS.map(bits => bits / 8));

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
