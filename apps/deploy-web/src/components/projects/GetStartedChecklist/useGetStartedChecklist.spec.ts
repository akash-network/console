import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { FeatureFlag } from "@src/types/feature-flags";
import type { OrganizationType } from "@src/types/organization";
import { DEPENDENCIES, SET_UP_STATE_DURATION_MS, useGetStartedChecklist } from "./useGetStartedChecklist";

import { act, waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useGetStartedChecklist.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows nothing done for a new trial account in its personal organization", () => {
    const { result } = setup();

    expect(result.current.isVisible).toBe(true);
    expect(result.current.steps).toEqual({ hasDeployed: false, hasApiKey: false, hasConnectedAgent: false });
    expect(result.current.doneCount).toBe(0);
    expect(result.current.stepCount).toBe(2);
    expect(result.current.isComplete).toBe(false);
  });

  it("reads each fact from what the user already did, leaving the tools step open until a setup command is copied", () => {
    const { result } = setup({ hasLease: true, apiKeyCount: 1 });

    expect(result.current.steps).toEqual({ hasDeployed: true, hasApiKey: true, hasConnectedAgent: false });
    expect(result.current.hasSetUpTools).toBe(false);
    expect(result.current.doneCount).toBe(1);
  });

  it("leaves the tools step open after a copy until the user also has a key", () => {
    const { result } = setup({ agentSetupCopiedAt: "2026-11-01T00:00:00Z" });

    expect(result.current.steps.hasConnectedAgent).toBe(true);
    expect(result.current.hasSetUpTools).toBe(false);
    expect(result.current.doneCount).toBe(0);
  });

  it("checks the tools step once the user has a key and copied a setup command on any device", () => {
    const { result } = setup({ apiKeyCount: 1, agentSetupCopiedAt: "2026-11-01T00:00:00Z" });

    expect(result.current.hasSetUpTools).toBe(true);
    expect(result.current.doneCount).toBe(1);
  });

  it("is hidden while the intent-first onboarding is off", () => {
    const { result } = setup({ enabledFlags: [] });

    expect(result.current.isVisible).toBe(false);
  });

  it("is hidden once the account has left the trial", () => {
    const { result } = setup({ isTrialing: false });

    expect(result.current.isVisible).toBe(false);
  });

  it("is hidden in a team organization", () => {
    const { result } = setup({ organizationType: "team" });

    expect(result.current.isVisible).toBe(false);
  });

  it("is hidden until the active organization is known", () => {
    const { result } = setup({ organizationType: null });

    expect(result.current.isVisible).toBe(false);
  });

  it("is hidden until the user is known", () => {
    const { result } = setup({ userId: null });

    expect(result.current.isVisible).toBe(false);
  });

  it("does not load progress for an account that would not see it", () => {
    const { useLeaseExistenceQuery, useUserApiKeys } = setup({ organizationType: "team" });

    expect(useLeaseExistenceQuery).toHaveBeenCalledWith("akash1trial", { enabled: false });
    expect(useUserApiKeys).toHaveBeenCalledWith({ enabled: false, refetchInterval: false });
  });

  it("loads progress without polling the API keys for an eligible account", () => {
    const { useLeaseExistenceQuery, useUserApiKeys } = setup();

    expect(useLeaseExistenceQuery).toHaveBeenCalledWith("akash1trial", { enabled: true });
    expect(useUserApiKeys).toHaveBeenCalledWith({ enabled: true, refetchInterval: false });
  });

  it.each([
    { isLeaseLoading: true, isApiKeysLoading: false },
    { isLeaseLoading: false, isApiKeysLoading: true }
  ])("waits for progress before showing so it does not jump (%o)", loading => {
    const { result } = setup(loading);

    expect(result.current.isVisible).toBe(false);
  });

  it("stays hidden once dismissed on any device", () => {
    const { result } = setup({ getStartedDismissedAt: "2026-11-01T00:00:00Z" });

    expect(result.current.isVisible).toBe(false);
  });

  it("hides right away on dismiss and remembers it for the user", async () => {
    const { result, analyticsService, consoleApiHttpClient, checkSession } = setup();

    act(() => result.current.dismiss());

    expect(result.current.isVisible).toBe(false);
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_dismissed", { category: "onboarding" });
    await waitFor(() => expect(checkSession).toHaveBeenCalled());
    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/user/markGetStartedDismissed");
  });

  it("reports a failed dismissal and stays hidden for this visit", async () => {
    const { result, errorHandler, checkSession } = setup({ postRejects: true });

    act(() => result.current.dismiss());

    await waitFor(() => expect(errorHandler.reportError).toHaveBeenCalledWith(expect.objectContaining({ tags: { category: "onboarding" } })));
    expect(checkSession).not.toHaveBeenCalled();
    expect(result.current.isVisible).toBe(false);
  });

  it("checks the agent step on copy and records it for the user", async () => {
    const { result, consoleApiHttpClient } = setup();

    act(() => result.current.markAgentSetupCopied());

    expect(result.current.steps.hasConnectedAgent).toBe(true);
    await waitFor(() => expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/user/markAgentSetupCopied"));
  });

  it("does not record the agent copy again once it is recorded", async () => {
    const { result, consoleApiHttpClient } = setup({ agentSetupCopiedAt: "2026-11-01T00:00:00Z" });

    await act(async () => result.current.markAgentSetupCopied());

    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("stays hidden for an account that finished every step before this visit", () => {
    const { result } = setup({ hasLease: true, apiKeyCount: 1, agentSetupCopiedAt: "2026-11-01T00:00:00Z" });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.isVisible).toBe(false);
  });

  it("shows the finished state for a moment after the last step, then hides", () => {
    vi.useFakeTimers();
    const { result } = setup({ hasLease: true, apiKeyCount: 1 });

    act(() => result.current.markAgentSetupCopied());

    expect(result.current.isComplete).toBe(true);
    expect(result.current.isVisible).toBe(true);

    act(() => vi.advanceTimersByTime(SET_UP_STATE_DURATION_MS - 1));
    expect(result.current.isVisible).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.isVisible).toBe(false);
  });

  it("still shows the finished state when the last step comes long after the visit started", () => {
    vi.useFakeTimers();
    const { result } = setup({ hasLease: true, apiKeyCount: 1 });

    act(() => vi.advanceTimersByTime(SET_UP_STATE_DURATION_MS * 2));
    act(() => result.current.markAgentSetupCopied());

    expect(result.current.isVisible).toBe(true);
  });

  function setup(
    input: {
      enabledFlags?: FeatureFlag[];
      isTrialing?: boolean;
      organizationType?: OrganizationType | null;
      userId?: string | null;
      hasLease?: boolean;
      isLeaseLoading?: boolean;
      apiKeyCount?: number;
      isApiKeysLoading?: boolean;
      getStartedDismissedAt?: string;
      agentSetupCopiedAt?: string;
      postRejects?: boolean;
    } = {}
  ) {
    const consoleApiHttpClient = mock<AxiosInstance>();
    if (input.postRejects) consoleApiHttpClient.post.mockRejectedValue(new Error("network error"));
    else consoleApiHttpClient.post.mockResolvedValue({ status: 204 });
    const analyticsService = mock<AnalyticsService>();
    const errorHandler = mock<ErrorHandlerService>();
    const checkSession = vi.fn(async () => undefined);
    const enabledFlags = input.enabledFlags ?? ["onboarding_intent_first"];
    const apiKeys = Array.from({ length: input.apiKeyCount ?? 0 }, () => mock<ApiKeyResponse>());

    const useLeaseExistenceQuery = vi.fn<typeof DEPENDENCIES.useLeaseExistenceQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLeaseExistenceQuery>>(), {
        data: input.isLeaseLoading ? undefined : input.hasLease ?? false,
        isLoading: input.isLeaseLoading ?? false
      })
    );
    const useUserApiKeys = vi.fn<typeof DEPENDENCIES.useUserApiKeys>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUserApiKeys>>(), {
        data: input.isApiKeysLoading ? undefined : apiKeys,
        isLoading: input.isApiKeysLoading ?? false
      })
    );

    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useFlag: flag => enabledFlags.includes(flag),
      useWallet: () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? true, hasWallet: true, address: "akash1trial" }),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization:
            input.organizationType === null
              ? undefined
              : {
                  id: "org-1",
                  name: "Personal",
                  slug: "personal",
                  type: input.organizationType ?? "personal",
                  role: "owner",
                  isActive: true,
                  createdAt: ""
                }
        }),
      useUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user:
            input.userId === null
              ? undefined
              : {
                  userId: input.userId ?? "user-1",
                  getStartedDismissedAt: input.getStartedDismissedAt ?? null,
                  agentSetupCopiedAt: input.agentSetupCopiedAt ?? null
                },
          checkSession
        }),
      useLeaseExistenceQuery,
      useUserApiKeys
    };

    const { result } = setupQuery(() => useGetStartedChecklist(dependencies), {
      services: {
        consoleApiHttpClient: () => consoleApiHttpClient,
        analyticsService: () => analyticsService,
        errorHandler: () => errorHandler
      }
    });

    return { result, consoleApiHttpClient, analyticsService, errorHandler, checkSession, useLeaseExistenceQuery, useUserApiKeys };
  }
});
