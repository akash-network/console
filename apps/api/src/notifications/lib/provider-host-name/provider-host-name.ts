/** A provider's host URI is whatever it declared on chain, so anything that is not a parseable URL is shown as it came. */
export function toProviderHostName(hostUri: string): string {
  try {
    return new URL(hostUri).hostname || hostUri;
  } catch {
    return hostUri;
  }
}
