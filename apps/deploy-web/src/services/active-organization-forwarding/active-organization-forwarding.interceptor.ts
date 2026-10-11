import type { InternalAxiosRequestConfig } from "axios";

import { ACTIVE_ORGANIZATION_HEADER_NAME, readActiveOrganizationCookie } from "@src/lib/active-organization/active-organization-cookie";
import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";

export function activeOrganizationForwardingInterceptor(config: InternalAxiosRequestConfig) {
  const activeOrganizationId = readActiveOrganizationIdOfCurrentRequest();
  if (activeOrganizationId) config.headers.set(ACTIVE_ORGANIZATION_HEADER_NAME, activeOrganizationId);

  return config;
}

export function createActiveOrganizationForwardingFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const activeOrganizationId = readActiveOrganizationIdOfCurrentRequest();
    if (!activeOrganizationId) return fetchImpl(input, init);

    const headers = new Headers(init?.headers);
    headers.set(ACTIVE_ORGANIZATION_HEADER_NAME, activeOrganizationId);

    return fetchImpl(input, { ...init, headers });
  };
}

function readActiveOrganizationIdOfCurrentRequest() {
  return readActiveOrganizationCookie(requestExecutionContext.getStore()?.headers.get("cookie"));
}
