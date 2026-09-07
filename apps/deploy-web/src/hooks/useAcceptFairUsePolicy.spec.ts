import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { DEPENDENCIES } from "./useAcceptFairUsePolicy";
import { useAcceptFairUsePolicy } from "./useAcceptFairUsePolicy";

import { act } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useAcceptFairUsePolicy.name, () => {
  it("persists the acceptance and refreshes the session profile", async () => {
    const { result, acceptFairUsePolicy, checkSession, analyticsService } = setup({});

    await act(() => result.current.accept());

    expect(acceptFairUsePolicy).toHaveBeenCalledTimes(1);
    expect(checkSession).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("fair_use_policy_accepted", { category: "user" });
  });

  it("reports a failed acceptance without throwing so the modal stays up for a retry", async () => {
    const error = new Error("network down");
    const { result, errorHandler, checkSession, analyticsService } = setup({ acceptError: error });

    await act(() => result.current.accept());

    expect(errorHandler.reportError).toHaveBeenCalledWith({ error, tags: { category: "user" } });
    expect(checkSession).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(result.current.isAccepting).toBe(false);
  });

  function setup(input: { acceptError?: Error }) {
    const acceptFairUsePolicy = input.acceptError ? vi.fn().mockRejectedValue(input.acceptError) : vi.fn().mockResolvedValue(undefined);
    const api = createProxy({ v1: { acceptFairUsePolicy } }) as unknown as ApiService;
    const analyticsService = mock<AnalyticsService>();
    const errorHandler = mock<ErrorHandlerService>();
    const checkSession = vi.fn().mockResolvedValue(undefined);
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ checkSession });

    const { result } = setupQuery(() => useAcceptFairUsePolicy({ useUser }), {
      services: {
        api: () => api,
        analyticsService: () => analyticsService,
        errorHandler: () => errorHandler
      }
    });

    return { result, acceptFairUsePolicy, analyticsService, errorHandler, checkSession };
  }
});
