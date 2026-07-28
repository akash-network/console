import type { NextApiResponse } from "next";

/** One-shot, JS-readable cookie the server auth callbacks set right after a brand-new account is created. */
export const ACCOUNT_CREATED_COOKIE = "account_created";

/** Short-lived: the client reads and clears it on the next load; this only bounds the window if it never does. */
const COOKIE_OPTIONS = "Path=/; Max-Age=300; SameSite=Lax";

/**
 * Hands the "a new account was just created" signal from the server auth callbacks to the browser so the client can
 * emit `account_created` in the user's own session/device context. Appends to any cookies already on the response
 * (e.g. the session cookie) rather than replacing them.
 */
export function setAccountCreatedCookie(res: NextApiResponse): void {
  const existing = res.getHeader("Set-Cookie");
  const existingCookies = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  res.setHeader("Set-Cookie", [...existingCookies, `${ACCOUNT_CREATED_COOKIE}=1; ${COOKIE_OPTIONS}`]);
}
