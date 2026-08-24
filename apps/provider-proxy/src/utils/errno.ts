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

export type ProviderErrorCategory = "clientCertificateError" | "blockedAddress" | "providerUnreachable";

/**
 * Splits connection failures into the classes that matter downstream: a bad client certificate and a blocked
 * address are caller mistakes answered with 400, while everything else is the provider being unreachable and
 * is answered with 502. Only the last class tracks third-party downtime, so alerting keys off it.
 */
export function toProviderErrorCategory(errno: string | undefined): ProviderErrorCategory {
  if (errno?.startsWith("ERR_SSL_")) return "clientCertificateError";
  if (errno === "EFORBIDDEN") return "blockedAddress";
  return "providerUnreachable";
}
