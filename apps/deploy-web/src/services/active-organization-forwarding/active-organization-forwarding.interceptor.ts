import type { InternalAxiosRequestConfig } from "axios";

import type { ConsoleLocation } from "@src/lib/active-organization/active-organization-cookie";
import { ACTIVE_ORGANIZATION_HEADER_NAME, readActiveOrganizationCookie } from "@src/lib/active-organization/active-organization-cookie";
import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";

type GetConsoleLocation = () => ConsoleLocation;

export function createActiveOrganizationForwardingInterceptor(getConsoleLocation: GetConsoleLocation) {
  return function activeOrganizationForwardingInterceptor(config: InternalAxiosRequestConfig) {
    const activeOrganizationId = readActiveOrganizationIdOfCurrentRequest(getConsoleLocation);
    if (activeOrganizationId) config.headers.set(ACTIVE_ORGANIZATION_HEADER_NAME, activeOrganizationId);

    return config;
  };
}

export function createActiveOrganizationForwardingFetch(getConsoleLocation: GetConsoleLocation, fetchImpl: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const activeOrganizationId = readActiveOrganizationIdOfCurrentRequest(getConsoleLocation);
    if (!activeOrganizationId) return fetchImpl(input, init);

    const headers = new Headers(init?.headers);
    headers.set(ACTIVE_ORGANIZATION_HEADER_NAME, activeOrganizationId);

    return fetchImpl(input, { ...init, headers });
  };
}

function readActiveOrganizationIdOfCurrentRequest(getConsoleLocation: GetConsoleLocation) {
  return readActiveOrganizationCookie(requestExecutionContext.getStore()?.headers.get("cookie"), getConsoleLocation());
}
