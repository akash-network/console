import { protos } from "@google-cloud/kms";

import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";
import { MAX_SDL_REFERENCE_NAME_LENGTH } from "@src/deployment/services/sdl-reference/sdl-reference.service";

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

/**
 * The only message a client gets when anything about the sealing key goes wrong. Deliberately says
 * nothing: the error handler echoes `message` for every `http-errors` instance regardless of
 * `expose`, so a specific message would tell a caller whether this instance can reach Cloud KMS,
 * holds a verified key, or has warmed its cache yet.
 */
export const SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE = "Service temporarily unavailable";

/** JSON spends `"name":"value",` around each entry: two quote pairs, a colon and a separator. */
const JSON_ENTRY_OVERHEAD_BYTES = 6;

/**
 * What a string costs inside the seal's plaintext, which is a JSON object and not the raw bytes of what
 * it carries: its escaped form, less the two quotes `JSON.stringify` puts around it, because the quotes
 * are already counted per entry above. Escaping is not size-preserving — a `"` or `\` costs two bytes
 * and a control byte up to six — so measuring the raw value would let a hundred quote-heavy values
 * overrun a budget computed as though they were plain, and the request would then be refused by the
 * body limit with a bare 413 instead of a 400 naming the limit it broke.
 */
export function jsonEncodedBytes(value: string): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8") - 2;
}

/**
 * Everything a compact JWE adds beyond its ciphertext segment: a protected header, an RSA-4096
 * encrypted key, a 96-bit IV, a 128-bit tag and four separators. Rounded up from the ~990 bytes those
 * actually come to, and sized against the largest modulus `SDL_SECRETS_WRAPPED_KEY_BYTES` accepts
 * rather than the one a key is likely to have.
 */
const SEAL_ENVELOPE_ALLOWANCE_BYTES = 1024;

/** base64url spends four characters on every three bytes, with no padding. */
function base64UrlLength(bytes: number) {
  return Math.ceil(bytes / 3) * 4;
}

/**
 * The largest seal the stated limits can produce, so a body limit can be sized on the limits rather
 * than the limits trimmed to fit a body limit. AES-GCM is a counter mode, so its ciphertext is
 * byte-for-byte its plaintext and the JSON object below is the only thing that has to be measured.
 *
 * An exact bound rather than an estimate, but only because the intake measures a name and a value the
 * same way this does — `jsonEncodedBytes`, against `MAX_SDL_REFERENCE_NAME_LENGTH` and the configured
 * value size. Measure either of them raw and this stops being a bound at all.
 */
export function maxSealedSecretsBytes({ maxCount, maxValueBytes }: { maxCount: number; maxValueBytes: number }) {
  const plaintextBytes = maxCount * (MAX_SDL_REFERENCE_NAME_LENGTH + JSON_ENTRY_OVERHEAD_BYTES + maxValueBytes) + 1;

  return base64UrlLength(plaintextBytes) + SEAL_ENVELOPE_ALLOWANCE_BYTES;
}

/** Secrets per deployment, and bytes per value. Configurable, but only downwards without also resizing the create route's body limit. */
export const SDL_SECRETS_DEFAULT_MAX_COUNT = 100;
export const SDL_SECRETS_DEFAULT_MAX_VALUE_BYTES = 16 * 1024;

/**
 * What `POST /v1/deployments` accepts once it can carry a seal: the whole existing allowance, kept
 * intact so the submitted SDL's ceiling does not move, plus exactly the largest seal the default
 * limits can produce. The margin is the conservatism in each term above rather than a percentage
 * added at the end.
 */
export const CREATE_DEPLOYMENT_BODY_LIMIT_BYTES =
  DEFAULT_BODY_LIMIT_BYTES + maxSealedSecretsBytes({ maxCount: SDL_SECRETS_DEFAULT_MAX_COUNT, maxValueBytes: SDL_SECRETS_DEFAULT_MAX_VALUE_BYTES });
