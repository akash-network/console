import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useSkipOnboarding";
import { useSkipOnboarding } from "@src/hooks/useSkipOnboarding";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { setupQuery } from "../../tests/unit/query-client";

import { act } from "@testing-library/react";

describe(useSkipOnboarding.name, () => {
  it("tracks the event, persists the flag, refreshes the session, then navigates to the deployments list", async () => {
    const { result, consoleApiHttpClient, analyticsService, checkSession, push } = setup();

    await act(async () => {
      await result.current.skip("picker");
    });

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_skipped", { category: "onboarding", source: "picker" });
    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/user/skipOnboarding");
    expect(checkSession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/deployments");
  });

  it("forwards the auto_deploy source to analytics", async () => {
    const { result, analyticsService } = setup();

    await act(async () => {
      await result.current.skip("auto_deploy");
    });

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_skipped", { category: "onboarding", source: "auto_deploy" });
  });

  it("navigates even when the session refresh fails", async () => {
    const { result, push } = setup({ checkSessionRejects: true });

    await act(async () => {
      await result.current.skip("picker");
    });

    expect(push).toHaveBeenCalledWith("/deployments");
  });

  it("does not navigate or refresh the session when persisting the flag fails", async () => {
    const { result, checkSession, push, errorHandler } = setup({ postRejects: true });

    await act(async () => {
      await result.current.skip("picker");
    });

    expect(checkSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(errorHandler.reportError).toHaveBeenCalled();
  });

  function setup(input?: { postRejects?: boolean; checkSessionRejects?: boolean }) {
    const consoleApiHttpClient = mock<AxiosInstance>();
    if (input?.postRejects) consoleApiHttpClient.post.mockRejectedValue(new Error("network error"));
    else consoleApiHttpClient.post.mockResolvedValue({ status: 204 } as never);

    const analyticsService = mock<AnalyticsService>();
    const errorHandler = mock<ErrorHandlerService>();
    const checkSession = vi.fn(input?.checkSessionRejects ? () => Promise.reject(new Error("refresh failed")) : () => Promise.resolve());
    const push = vi.fn();

    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ checkSession });
    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });

    const { result } = setupQuery(() => useSkipOnboarding({ useUser, useRouter }), {
      services: {
        consoleApiHttpClient: () => consoleApiHttpClient,
        analyticsService: () => analyticsService,
        errorHandler: () => errorHandler
      }
    });

    return { result, consoleApiHttpClient, analyticsService, errorHandler, checkSession, push };
  }
});
