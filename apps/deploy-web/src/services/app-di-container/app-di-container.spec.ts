import { ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { Mutation, Query } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACTIVE_ORGANIZATION_COOKIE_NAME } from "@src/lib/active-organization/active-organization-cookie";
import type { ApiUrlService } from "@src/services/api-url/api-url.service";
import { createAppRootContainer } from "./app-di-container";

describe(createAppRootContainer.name, () => {
  it("creates the managed wallet service from the http-sdk", () => {
    const { container } = setup();

    expect(container.managedWalletService).toBeInstanceOf(ManagedWalletHttpService);
  });

  it("drops the active organization when a query is refused for it", () => {
    const { container, staleOrganizationError } = setup();
    const queryClient = container.queryClient;
    const clear = vi.spyOn(queryClient, "clear");
    const reportError = vi.spyOn(container.errorHandler, "reportError");

    queryClient.getQueryCache().config.onError?.(staleOrganizationError, mock<Query<unknown, unknown, unknown>>());

    expect(document.cookie).not.toContain(`${ACTIVE_ORGANIZATION_COOKIE_NAME}=`);
    expect(clear).toHaveBeenCalledOnce();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("drops the active organization when a mutation is refused for it", () => {
    const { container, staleOrganizationError } = setup();
    const queryClient = container.queryClient;
    const clear = vi.spyOn(queryClient, "clear");
    const reportError = vi.spyOn(container.errorHandler, "reportError");

    queryClient.getMutationCache().config.onError?.(staleOrganizationError, undefined, undefined, mock<Mutation<unknown, unknown, unknown, unknown>>());

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
