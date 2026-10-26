import type { NextApiRequest } from "next";

import { detectBrowserTimezone } from "./browser-timezone";

export const BROWSER_TIMEZONE_COOKIE_NAME = "console_tz";

const BROWSER_TIMEZONE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function serializeBrowserTimezoneCookie(timeZone: string, location: Pick<Location, "protocol">): string {
  const cookie = `${BROWSER_TIMEZONE_COOKIE_NAME}=${encodeURIComponent(timeZone)}; Path=/; Max-Age=${BROWSER_TIMEZONE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;

  return location.protocol === "https:" ? `${cookie}; Secure` : cookie;
}

/** Sign-in runs on the server, which learns the browser's timezone only from this cookie. */
export function rememberBrowserTimezone(document: Pick<Document, "cookie">, location: Pick<Location, "protocol">): void {
  const timeZone = detectBrowserTimezone();
  if (timeZone) document.cookie = serializeBrowserTimezoneCookie(timeZone, location);
}

export function readBrowserTimezone(req: Pick<NextApiRequest, "cookies">): string | undefined {
  return req.cookies[BROWSER_TIMEZONE_COOKIE_NAME];
}
