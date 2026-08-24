/**
 * Reads the libuv/OpenSSL error code off an unknown thrown value. Node surfaces connection failures as an
 * ErrnoException whose `code` is the only machine-readable signal of what went wrong, and the logger's
 * serializer folds it into a stack string, so it has to be pulled out before logging to stay queryable.
 */
export function toErrno(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;

  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === "string" ? code : undefined;
}

export type ProviderErrorCategory = "tlsHandshakeError" | "blockedAddress" | "providerUnreachable";

/**
 * Splits connection failures into the classes that matter downstream: a failed TLS handshake and a blocked
 * address are answered with 400, while everything else is the provider being unreachable and is answered
 * with 502. Only the last class tracks third-party downtime, so alerting keys off it.
 *
 * The ERR_SSL_ prefix covers more than a rejected client certificate, since OpenSSL also reports protocol
 * and record failures under it. Narrowing it would change which errors answer 400, so the existing routing
 * is kept and the category is named after what the prefix actually means.
 */
export function toProviderErrorCategory(errno: string | undefined): ProviderErrorCategory {
  if (errno?.startsWith("ERR_SSL_")) return "tlsHandshakeError";
  if (errno === "EFORBIDDEN") return "blockedAddress";
  return "providerUnreachable";
}
