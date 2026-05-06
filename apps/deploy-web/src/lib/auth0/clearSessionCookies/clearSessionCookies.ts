import type { NextApiRequest, NextApiResponse } from "next";

const SESSION_COOKIE_PREFIX = "appSession";
const EXPIRED_COOKIE_OPTIONS = "Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

export function clearSessionCookies(req: NextApiRequest, res: NextApiResponse): void {
  const cookies = req.cookies;
  const expiredCookies = Object.keys(cookies)
    .filter(key => key.startsWith(SESSION_COOKIE_PREFIX))
    .map(key => `${key}=; ${EXPIRED_COOKIE_OPTIONS}`);

  if (expiredCookies.length > 0) {
    const existing = res.getHeader("Set-Cookie");
    const existingCookies = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
    res.setHeader("Set-Cookie", [...existingCookies, ...expiredCookies]);
  }
}
