/**
 * Single source of truth for "is this session's access token past its expiry". Shared by the SSR
 * page guards, the auth0 profile handler, and the refreshing session wrapper so a future rule change
 * (e.g. clock-skew leeway) lands in one place. A missing `accessTokenExpiresAt` counts as expired.
 */
export function isAccessTokenExpired(session: { accessTokenExpiresAt?: number } | null | undefined): boolean {
  return (session?.accessTokenExpiresAt || 0) * 1_000 <= Date.now();
}
