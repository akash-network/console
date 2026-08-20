/** The JOSE name for the scheme Cloud KMS calls `RSA_DECRYPT_OAEP_*_SHA256`. */
export const SDL_SECRETS_SEAL_ALGORITHM = "RSA-OAEP-256";

/** The only content encryption the console accepts for a seal. */
export const SDL_SECRETS_CONTENT_ENCRYPTION = "A256GCM";

/**
 * Claims a client must put in the protected header of a sealed payload. Advertised rather than
 * documented so that promoting a claim is a server-side change instead of a client release.
 */
export const SDL_SECRETS_REQUIRED_CLAIMS = ["kid", "sub", "exp"] as const;
