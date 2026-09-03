import { protos } from "@google-cloud/kms";

import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";
import { MAX_SDL_REFERENCE_NAME_LENGTH } from "@src/deployment/services/sdl-reference/sdl-reference.service";

const { CryptoKeyVersionAlgorithm } = protos.google.cloud.kms.v1.CryptoKeyVersion;

/** The JOSE name for the scheme Cloud KMS calls `RSA_DECRYPT_OAEP_*_SHA256`. */
export const SDL_SECRETS_SEAL_ALGORITHM = "RSA-OAEP-256";

const SEALING_KEY_MODULUS_BITS = [2048, 3072, 4096] as const;

const SEALING_KEY_ALGORITHM_NAMES = SEALING_KEY_MODULUS_BITS.map(bits => `RSA_DECRYPT_OAEP_${bits}_SHA256` as const);

/** Holds both encodings of each algorithm, because the Cloud KMS API reports an enum as either its name or its ordinal. */
export const SDL_SECRETS_SEALING_KEY_ALGORITHMS: ReadonlySet<string | number> = new Set(
  SEALING_KEY_ALGORITHM_NAMES.flatMap(name => [name, CryptoKeyVersionAlgorithm[name]])
);

/** RSA ciphertext is exactly the modulus size, so a garbage encrypted key can be refused locally instead of spending an unwrap. */
export const SDL_SECRETS_WRAPPED_KEY_BYTES: ReadonlySet<number> = new Set(SEALING_KEY_MODULUS_BITS.map(bits => bits / 8));

/** The only content encryption the console accepts for a seal. */
export const SDL_SECRETS_CONTENT_ENCRYPTION = "A256GCM";

/** Advertised rather than documented, so promoting a claim is a server-side change instead of a client release. */
export const SDL_SECRETS_REQUIRED_CLAIMS = ["kid", "sub", "exp"] as const;

/** Bounds how long a captured seal stays replayable, with enough slack above the client's own lifetime to absorb clock skew. */
export const SDL_SECRETS_MAX_SEAL_LIFETIME_MS = 15 * 60 * 1000;

/** Deliberately says nothing, because the error handler echoes `message` for every `http-errors` instance regardless of `expose`. */
export const SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE = "Service temporarily unavailable";

/** JSON spends `"name":"value",` around each entry: two quote pairs, a colon and a separator. */
const JSON_ENTRY_OVERHEAD_BYTES = 6;

/** Escaping is not size-preserving, so a string costs its escaped form less the two quotes already counted per entry above. */
export function jsonEncodedBytes(value: string): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8") - 2;
}

/** Everything a compact JWE adds beyond its ciphertext, rounded up from ~990 bytes at the largest modulus `SDL_SECRETS_WRAPPED_KEY_BYTES` accepts. */
const SEAL_ENVELOPE_ALLOWANCE_BYTES = 1024;

/** base64url spends four characters on every three bytes, with no padding to round the last group up. */
function base64UrlLength(bytes: number) {
  return Math.ceil((bytes * 4) / 3);
}

/** A bound rather than an estimate only because the intake measures a name and a value with `jsonEncodedBytes` exactly as this does. */
export function maxSealedSecretsBytes({ maxCount, maxValueBytes }: { maxCount: number; maxValueBytes: number }) {
  const plaintextBytes = maxCount * (MAX_SDL_REFERENCE_NAME_LENGTH + JSON_ENTRY_OVERHEAD_BYTES + maxValueBytes) + 1;

  return base64UrlLength(plaintextBytes) + SEAL_ENVELOPE_ALLOWANCE_BYTES;
}

/** Secrets per deployment, and bytes per value. Configurable, but only downwards without also resizing the create route's body limit. */
export const SDL_SECRETS_DEFAULT_MAX_COUNT = 100;

/** Measured JSON-encoded, so a value carrying quotes or backslashes fits less raw content than a plain one — unpublished along with the field, so it is recorded here instead. */
export const SDL_SECRETS_DEFAULT_MAX_VALUE_BYTES = 16 * 1024;

/** The whole existing allowance, kept intact so the submitted SDL's ceiling does not move, plus the largest seal the defaults can produce. */
export const CREATE_DEPLOYMENT_BODY_LIMIT_BYTES =
  DEFAULT_BODY_LIMIT_BYTES + maxSealedSecretsBytes({ maxCount: SDL_SECRETS_DEFAULT_MAX_COUNT, maxValueBytes: SDL_SECRETS_DEFAULT_MAX_VALUE_BYTES });
