import { base64url, CompactEncrypt, importJWK } from "jose";

import type { SdlSecretValues } from "./sdlSecrets";

export const SDL_SECRETS_SEAL_ALGORITHM = "RSA-OAEP-256";

export const SDL_SECRETS_CONTENT_ENCRYPTION = "A256GCM";

/** Well inside the api's fifteen-minute ceiling, so clock skew on either side cannot push a fresh seal past it. */
export const SDL_SECRETS_SEAL_LIFETIME_SECONDS = 5 * 60;

/** What `GET /v1/sdl-secrets-context` hands back: the key to seal to, its version, and the user the seal is for. */
export interface SdlSecretsSealContext {
  kid: string;
  sub: string;
  jwk: { kty: string; n: string; e: string; use?: string; alg?: string };
}

export interface SealSdlSecretsInput {
  context: SdlSecretsSealContext;
  /** The exact SDL string the seal travels with, so the api can refuse the seal beside any other document. */
  sdl: string;
  secrets: SdlSecretValues;
}

/** Seals the typed secret values into the compact JWE a create accepts, bound to the user, the key version and the SDL. */
export async function sealSdlSecrets({ context, sdl, secrets }: SealSdlSecretsInput): Promise<string> {
  const sealingKey = await importJWK({ ...context.jwk, alg: SDL_SECRETS_SEAL_ALGORITHM }, SDL_SECRETS_SEAL_ALGORITHM);
  const sdlHash = base64url.encode(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8BytesOf(sdl))));

  return new CompactEncrypt(utf8BytesOf(JSON.stringify(secrets)))
    .setProtectedHeader({
      alg: SDL_SECRETS_SEAL_ALGORITHM,
      enc: SDL_SECRETS_CONTENT_ENCRYPTION,
      kid: context.kid,
      sub: context.sub,
      exp: Math.floor(Date.now() / 1000) + SDL_SECRETS_SEAL_LIFETIME_SECONDS,
      sdlHash
    })
    .encrypt(sealingKey);
}

/** Copied into this realm's Uint8Array, which jose requires the plaintext to be an instance of and a TextEncoder does not guarantee. */
function utf8BytesOf(text: string): Uint8Array {
  return Uint8Array.from(new TextEncoder().encode(text));
}
