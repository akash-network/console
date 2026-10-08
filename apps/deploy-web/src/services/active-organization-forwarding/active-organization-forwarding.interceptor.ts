import type { InternalAxiosRequestConfig } from "axios";

import { ACTIVE_ORGANIZATION_HEADER_NAME, readActiveOrganizationCookie } from "@src/lib/active-organization/active-organization-cookie";
import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";

export function activeOrganizationForwardingInterceptor(config: InternalAxiosRequestConfig) {
  const activeOrganizationId = readActiveOrganizationCookie(requestExecutionContext.getStore()?.headers.get("cookie"));
  if (activeOrganizationId) config.headers.set(ACTIVE_ORGANIZATION_HEADER_NAME, activeOrganizationId);

  return config;
}
