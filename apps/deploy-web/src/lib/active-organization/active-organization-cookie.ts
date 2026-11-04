import type { NextApiResponse } from "next";

import { readCookieEntries } from "@src/lib/cookie-header/cookie-header";

export const ACTIVE_ORGANIZATION_HEADER_NAME = "x-organization-id";

/** Browsers accept a `__Host-` cookie only when it is Secure, so a console served over plain http keeps the unprefixed name. */
const HOST_BOUND_ACTIVE_ORGANIZATION_COOKIE_NAME = "__Host-console_org";
const ACTIVE_ORGANIZATION_COOKIE_NAME = "console_org";

const ACTIVE_ORGANIZATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** An organization uuid or slug, which the API resolves either way. */
const ACTIVE_ORGANIZATION_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

export type ConsoleLocation = Pick<Location, "protocol">;

export function getActiveOrganizationCookieName(location: ConsoleLocation): string {
  return isServedOverHttps(location) ? HOST_BOUND_ACTIVE_ORGANIZATION_COOKIE_NAME : ACTIVE_ORGANIZATION_COOKIE_NAME;
}

export function readActiveOrganizationCookie(cookieHeader: string | null | undefined, location: ConsoleLocation): string | undefined {
  const values = readActiveOrganizationCookieValues(cookieHeader, location);
  const [value] = values;

  return values.length === 1 && ACTIVE_ORGANIZATION_ID_PATTERN.test(value) ? value : undefined;
}

export function hasDuplicateActiveOrganizationCookie(cookieHeader: string | null | undefined, location: ConsoleLocation): boolean {
  return readActiveOrganizationCookieValues(cookieHeader, location).length > 1;
}

export function readActiveOrganizationHeader(headerValue: string | string[] | undefined): string | undefined {
  return typeof headerValue === "string" && ACTIVE_ORGANIZATION_ID_PATTERN.test(headerValue) ? headerValue : undefined;
}

export function serializeActiveOrganizationCookie(organizationId: string, location: ConsoleLocation = window.location): string {
  const name = getActiveOrganizationCookieName(location);

  return withSecureAttributeOnHttps(`${name}=${organizationId}; Path=/; Max-Age=${ACTIVE_ORGANIZATION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`, location);
}

export function serializeActiveOrganizationCookieRemoval(location: ConsoleLocation = window.location): string {
  return withSecureAttributeOnHttps(`${getActiveOrganizationCookieName(location)}=; Path=/; Max-Age=0; SameSite=Lax`, location);
}

export function expireActiveOrganizationCookie(res: NextApiResponse, location: ConsoleLocation): void {
  const existing = res.getHeader("Set-Cookie");
  const existingCookies = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  res.setHeader("Set-Cookie", [...existingCookies, serializeActiveOrganizationCookieRemoval(location)]);
}

function readActiveOrganizationCookieValues(cookieHeader: string | null | undefined, location: ConsoleLocation): string[] {
  const name = getActiveOrganizationCookieName(location);

  return readCookieEntries(cookieHeader)
    .filter(entry => entry.name === name)
    .map(entry => entry.value);
}

function withSecureAttributeOnHttps(cookie: string, location: ConsoleLocation): string {
  return isServedOverHttps(location) ? `${cookie}; Secure` : cookie;
}

function isServedOverHttps(location: ConsoleLocation): boolean {
  return location.protocol === "https:";
}
