import type { InternalAxiosRequestConfig } from "axios";

import { ACTIVE_ORGANIZATION_HEADER_NAME } from "@src/lib/active-organization/active-organization-cookie";
import { PROXY_API_BASE_URL } from "@src/services/auth/auth/interceptors";

/** The organization one browser tab shows, which its API calls name because the console_org cookie is shared by every tab. */
export class TabOrganization {
  #organizationId: string | undefined;

  get organizationId(): string | undefined {
    return this.#organizationId;
  }

  show(organizationId: string | undefined): void {
    this.#organizationId = organizationId;
  }

  async actIn<T>(organizationId: string, work: () => Promise<T>): Promise<T> {
    const shownOrganizationId = this.#organizationId;
    this.#organizationId = organizationId;

    try {
      return await work();
    } finally {
      if (this.#organizationId === organizationId) this.#organizationId = shownOrganizationId;
    }
  }
}

export function createTabOrganizationInterceptor(tabOrganization: TabOrganization) {
  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const { organizationId } = tabOrganization;
    if (organizationId && config.baseURL === PROXY_API_BASE_URL) config.headers.set(ACTIVE_ORGANIZATION_HEADER_NAME, organizationId);

    return config;
  };
}

export function createTabOrganizationFetch(tabOrganization: TabOrganization, fetchImpl: typeof fetch): typeof fetch {
  return (input, init) => {
    const { organizationId } = tabOrganization;
    if (!organizationId) return fetchImpl(input, init);

    const headers = new Headers(init?.headers);
    headers.set(ACTIVE_ORGANIZATION_HEADER_NAME, organizationId);

    return fetchImpl(input, { ...init, headers });
  };
}
