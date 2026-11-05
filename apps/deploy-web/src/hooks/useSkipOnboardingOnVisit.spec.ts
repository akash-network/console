import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useSkipOnboardingOnVisit";
import { useSkipOnboardingOnVisit } from "@src/hooks/useSkipOnboardingOnVisit";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { setupQuery } from "../../tests/unit/query-client";

describe(useSkipOnboardingOnVisit.name, () => {
  it("tracks, persists the skip and refreshes the session for a user known not to be onboarded", async () => {
    const { consoleApiHttpClient, analyticsService, checkSession } = setup({ isKnownNotOnboarded: true });

    await vi.waitFor(() => expect(checkSession).toHaveBeenCalled());
    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_skipped", { category: "onboarding", source: "billing" });
    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/user/skipOnboarding");
  });

  it("leaves an onboarded or still loading user alone", async () => {
    const { consoleApiHttpClient, analyticsService } = setup({ isKnownNotOnboarded: false });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("skips once the onboarding state settles as not onboarded", async () => {
    const { consoleApiHttpClient, rerender, setKnownNotOnboarded } = setup({ isKnownNotOnboarded: false });

    setKnownNotOnboarded(true);
    rerender();

    await vi.waitFor(() => expect(consoleApiHttpClient.post).toHaveBeenCalledTimes(1));
  });

  it("skips only once across re-renders", async () => {
    const { consoleApiHttpClient, checkSession, rerender } = setup({ isKnownNotOnboarded: true });

    await vi.waitFor(() => expect(checkSession).toHaveBeenCalled());
    rerender();
    rerender();

    expect(consoleApiHttpClient.post).toHaveBeenCalledTimes(1);
  });

  it("reports a failed skip without retrying it", async () => {
    const { consoleApiHttpClient, errorHandler, checkSession, rerender } = setup({ isKnownNotOnboarded: true, postRejects: true });

    await vi.waitFor(() => expect(errorHandler.reportError).toHaveBeenCalledWith(expect.objectContaining({ tags: { category: "onboarding" } })));
    rerender();

    expect(consoleApiHttpClient.post).toHaveBeenCalledTimes(1);
    expect(checkSession).not.toHaveBeenCalled();
  });

  function setup(input: { isKnownNotOnboarded: boolean; postRejects?: boolean }) {
    const consoleApiHttpClient = mock<AxiosInstance>();
    if (input.postRejects) consoleApiHttpClient.post.mockRejectedValue(new Error("network error"));
    else consoleApiHttpClient.post.mockResolvedValue({ status: 204 } as never);

    const analyticsService = mock<AnalyticsService>();
    const errorHandler = mock<ErrorHandlerService>();
    const checkSession = vi.fn().mockResolvedValue(undefined);
    let isKnownNotOnboarded = input.isKnownNotOnboarded;

    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ checkSession });
    const useIsKnownNotOnboarded: typeof DEPENDENCIES.useIsKnownNotOnboarded = () => isKnownNotOnboarded;

    const { rerender } = setupQuery(() => useSkipOnboardingOnVisit("billing", { useUser, useIsKnownNotOnboarded }), {
      services: {
        consoleApiHttpClient: () => consoleApiHttpClient,
        analyticsService: () => analyticsService,
        errorHandler: () => errorHandler
      }
    });

    const setKnownNotOnboarded = (value: boolean) => {
      isKnownNotOnboarded = value;
    };

    return { consoleApiHttpClient, analyticsService, errorHandler, checkSession, rerender, setKnownNotOnboarded };
  }
});
