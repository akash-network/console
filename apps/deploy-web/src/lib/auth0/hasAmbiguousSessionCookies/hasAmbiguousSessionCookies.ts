import { readCookieEntries } from "@src/lib/cookie-header/cookie-header";

const SESSION_COOKIE_NAME = "appSession";
const SESSION_COOKIE_NAME_PATTERN = /^appSession(\.\d+)?$/;

/** The SDK reads a whole `appSession` before any `appSession.N` chunks, so carrying both forms is as ambiguous as carrying one name twice. */
export function hasAmbiguousSessionCookies(cookieHeader: string | undefined): boolean {
  const names = readCookieEntries(cookieHeader)
    .map(entry => entry.name)
    .filter(name => SESSION_COOKIE_NAME_PATTERN.test(name));
  const hasRepeatedName = new Set(names).size < names.length;
  const hasWholeAndChunkedForms = names.includes(SESSION_COOKIE_NAME) && names.some(name => name !== SESSION_COOKIE_NAME);

  return hasRepeatedName || hasWholeAndChunkedForms;
}
