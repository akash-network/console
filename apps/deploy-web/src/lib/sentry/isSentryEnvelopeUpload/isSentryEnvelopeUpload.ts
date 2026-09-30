export function isSentryEnvelopeUpload(url: string): boolean {
  return url.includes("sentry_key=") && url.includes("sentry_client=");
}
