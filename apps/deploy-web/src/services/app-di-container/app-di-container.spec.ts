import { ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACTIVE_ORGANIZATION_COOKIE_NAME } from "@src/lib/active-organization/active-organization-cookie";
import type { ApiUrlService } from "@src/services/api-url/api-url.service";
import { withUserToken } from "@src/services/auth/auth/interceptors";
import { createAppRootContainer } from "./app-di-container";

describe(createAppRootContainer.name, () => {
  it("creates the managed wallet service from the http-sdk", () => {
    const { container } = setup();

    expect(container.managedWalletService).toBeInstanceOf(ManagedWalletHttpService);
  });

  it("names the organization the tab shows on calls through the API proxy", async () => {
    const { container } = setup();
    const sentConfigs: InternalAxiosRequestConfig[] = [];
    const client = container.applyAxiosInterceptors(
      container.createAxios({
        adapter: async config => {
          sentConfigs.push(config);
          return { data: {}, status: 200, statusText: "OK", headers: {}, config };
        }
      }),
      { request: [withUserToken] }
    );
    container.tabOrganization.show("org-shown");

    await client.get("/v1/projects");

    expect(sentConfigs.map(config => config.headers.get("x-organization-id"))).toEqual(["org-shown"]);
  });

  it("names nothing on a call that does not go through the API proxy", async () => {
    const { container } = setup();
    const sentConfigs: InternalAxiosRequestConfig[] = [];
    const client = container.applyAxiosInterceptors(
      container.createAxios({
        baseURL: "http://localhost:3040",
        adapter: async config => {
          sentConfigs.push(config);
          return { data: {}, status: 200, statusText: "OK", headers: {}, config };
        }
      })
    );
    container.tabOrganization.show("org-shown");

    await client.get("/v1/status");

    expect(sentConfigs.map(config => config.headers.has("x-organization-id"))).toEqual([false]);
  });

  it("stops naming the organization the tab shows when a call is refused for it", () => {
    const { container, staleOrganizationError } = setup();
    container.tabOrganization.show("org-stale");

    container.queryClient.getQueryCache().config.onError?.(staleOrganizationError, cachedQuery(container.queryClient));

    expect(container.tabOrganization.organizationId).toBeUndefined();
  });

  it("leaves the organization alone and reports nothing when a call an earlier recovery dropped is refused", () => {
    const { container, staleOrganizationError } = setup();
    const queryClient = container.queryClient;
    const clear = vi.spyOn(queryClient, "clear");
    const reportError = vi.spyOn(container.errorHandler, "reportError");
    container.tabOrganization.show("org-shown");
    const droppedQuery = cachedQuery(queryClient);
    const droppedMutation = cachedMutation(queryClient);
    queryClient.getQueryCache().remove(droppedQuery);
    queryClient.getMutationCache().remove(droppedMutation);
    cachedQuery(queryClient);
    cachedMutation(queryClient);

    queryClient.getQueryCache().config.onError?.(staleOrganizationError, droppedQuery);
    queryClient.getMutationCache().config.onError?.(staleOrganizationError, undefined, undefined, droppedMutation);

    expect(container.tabOrganization.organizationId).toBe("org-shown");
    expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-stale`);
    expect(clear).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("drops the active organization when a query is refused for it", () => {
    const { container, staleOrganizationError } = setup();
    const queryClient = container.queryClient;
    const clear = vi.spyOn(queryClient, "clear");
    const reportError = vi.spyOn(container.errorHandler, "reportError");

    queryClient.getQueryCache().config.onError?.(staleOrganizationError, cachedQuery(queryClient));

    expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
    expect(clear).toHaveBeenCalledOnce();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("drops the active organization when a mutation is refused for it", () => {
    const { container, staleOrganizationError } = setup();
    const queryClient = container.queryClient;
    const clear = vi.spyOn(queryClient, "clear");
    const reportError = vi.spyOn(container.errorHandler, "reportError");

    queryClient.getMutationCache().config.onError?.(staleOrganizationError, undefined, undefined, cachedMutation(queryClient));

    expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
    expect(clear).toHaveBeenCalledOnce();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("keeps the active organization when a call fails for another reason", () => {
    const { container } = setup();
    const queryClient = container.queryClient;
    const clear = vi.spyOn(queryClient, "clear");

    queryClient
      .getQueryCache()
      .config.onError?.(new ApiError(404, { code: "not_found" }, "GET → 404"), mock<Query<unknown, unknown, unknown>>({ meta: { reportError: () => false } }));

    expect(document.cookie).toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-stale`);
    expect(clear).not.toHaveBeenCalled();
  });

  function cachedQuery(queryClient: QueryClient) {
    return queryClient.getQueryCache().build<unknown, unknown, unknown, readonly unknown[]>(queryClient, { queryKey: ["v1", "deployments"] });
  }

  function cachedMutation(queryClient: QueryClient) {
    return queryClient.getMutationCache().build(queryClient, {});
  }

  function setup() {
    document.cookie = `${ACTIVE_ORGANIZATION_COOKIE_NAME}=org-stale; path=/`;
    const container = createAppRootContainer({
      runtimeEnv: "browser",
      BASE_API_MAINNET_URL: "http://localhost:3080",
      BASE_PROVIDER_PROXY_URL: "http://localhost:3040",
      MANAGED_WALLET_NETWORK_ID: "mainnet",
      apiUrlService: () => mock<ApiUrlService>()
    });
    const staleOrganizationError = new ApiError(403, { code: "organization_forbidden" }, "GET /v1/deployments → 403");

    return { container, staleOrganizationError };
  }
});
