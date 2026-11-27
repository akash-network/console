import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NewCardHandle } from "@src/components/organizations/NewCardFields/NewCardFields";
import { QueryKeys } from "@src/queries/queryKeys";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { DEPENDENCIES } from "./useStartTrialWithCard";
import { TRIAL_CARD_FAILED_MESSAGE, useStartTrialWithCard } from "./useStartTrialWithCard";

import { act } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useStartTrialWithCard.name, () => {
  it("saves the card on a trial setup intent, has the API confirm it and marks the card step verified", async () => {
    const { result, card, createTrialCardSetupIntent, confirmTrialCard, queryClient, invalidateQueries, analyticsService } = setup();

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "started" });
    expect(createTrialCardSetupIntent).toHaveBeenCalledTimes(1);
    expect(card.save).toHaveBeenCalledExactlyOnceWith("seti_1_secret");
    expect(confirmTrialCard).toHaveBeenCalledExactlyOnceWith({ data: { setupIntentId: "seti_1" } });
    expect(card.save.mock.invocationCallOrder[0]).toBeLessThan(confirmTrialCard.mock.invocationCallOrder[0]);
    expect(queryClient.getQueryData(["v1", "getTrialCard"])).toEqual({ data: { step: "verified" } });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getManagedWalletKey("user-1") });
    expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith("trial_card_verified", { category: "onboarding" });
    expect(result.current.isStarting).toBe(false);
  });

  it("stops at a card that is not filled in, before any setup intent exists", async () => {
    const { result, card, createTrialCardSetupIntent, analyticsService } = setup({ isCardValid: false });

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "incomplete" });
    expect(createTrialCardSetupIntent).not.toHaveBeenCalled();
    expect(card.save).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("gives Stripe's reason when the card is not saved, and confirms nothing", async () => {
    const { result, card, confirmTrialCard, queryClient, analyticsService } = setup({ cardSaveFailure: "Your card was declined." });

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "failed", message: "Your card was declined." });
    expect(confirmTrialCard).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["v1", "getTrialCard"])).toBeUndefined();
    expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith("trial_card_refused", { category: "onboarding", reason: "card_not_saved" });
  });

  it("fails without touching Stripe when the setup intent comes back without a client secret", async () => {
    const { result, card, confirmTrialCard } = setup({ clientSecret: null });

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "failed", message: "Something went wrong while saving it." });
    expect(card.save).not.toHaveBeenCalled();
    expect(confirmTrialCard).not.toHaveBeenCalled();
  });

  it("gives the API's reason when it refuses the card, without reporting it as a fault", async () => {
    const refusal = new ApiError(
      422,
      { code: "trial_card_already_used", message: "This card has already started a free trial. You can still add credits to deploy." },
      "POST /v1/trial-card/confirm → 422"
    );
    const { result, card, queryClient, invalidateQueries, analyticsService, errorHandler } = setup({ confirmFailure: refusal });

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "failed", message: "This card has already started a free trial. You can still add credits to deploy." });
    expect(queryClient.getQueryData(["v1", "getTrialCard"])).toBeUndefined();
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith("trial_card_refused", { category: "onboarding", reason: "trial_card_already_used" });
    expect(errorHandler.reportError).not.toHaveBeenCalled();
    expect(result.current.isStarting).toBe(false);
  });

  it("falls back to a general message for a refusal that carries none", async () => {
    const { result, card, analyticsService } = setup({ confirmFailure: new ApiError(404, {}, "POST /v1/trial-card/confirm → 404") });

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "failed", message: TRIAL_CARD_FAILED_MESSAGE });
    expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith("trial_card_refused", { category: "onboarding", reason: "error" });
  });

  it("reports a server failure and keeps its message from the user", async () => {
    const failure = new ApiError(500, { message: "relation trial_cards does not exist" }, "POST /v1/trial-card/confirm → 500");
    const { result, card, errorHandler } = setup({ confirmFailure: failure });

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "failed", message: TRIAL_CARD_FAILED_MESSAGE });
    expect(errorHandler.reportError).toHaveBeenCalledExactlyOnceWith({ error: failure, tags: { category: "onboarding" } });
  });

  it("reports a setup intent that cannot be created and saves no card", async () => {
    const failure = new Error("network down");
    const { result, card, errorHandler } = setup({ setupIntentFailure: failure });

    const outcome = await act(() => result.current.startTrial(card));

    expect(outcome).toEqual({ status: "failed", message: TRIAL_CARD_FAILED_MESSAGE });
    expect(card.save).not.toHaveBeenCalled();
    expect(errorHandler.reportError).toHaveBeenCalledExactlyOnceWith({ error: failure, tags: { category: "onboarding" } });
  });

  function setup(
    input: {
      isCardValid?: boolean;
      cardSaveFailure?: string;
      clientSecret?: string | null;
      setupIntentFailure?: Error;
      confirmFailure?: Error;
    } = {}
  ) {
    const card = mock<NewCardHandle>();
    card.validate.mockResolvedValue(input.isCardValid ?? true);
    card.save.mockResolvedValue(input.cardSaveFailure);
    const clientSecret = "clientSecret" in input ? input.clientSecret : "seti_1_secret";
    const createTrialCardSetupIntent = input.setupIntentFailure
      ? vi.fn().mockRejectedValue(input.setupIntentFailure)
      : vi.fn().mockResolvedValue({ data: { id: "seti_1", clientSecret } });
    const confirmTrialCard = input.confirmFailure ? vi.fn().mockRejectedValue(input.confirmFailure) : vi.fn().mockResolvedValue({ data: { step: "verified" } });
    const api = createProxy({ v1: { createTrialCardSetupIntent, confirmTrialCard, getTrialCard: vi.fn() } }) as unknown as ApiService;
    const analyticsService = mock<AnalyticsService>();
    const errorHandler = mock<ErrorHandlerService>();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { userId: "user-1" } })
    };

    const { result } = setupQuery(() => useStartTrialWithCard(dependencies), {
      services: { api: () => api, analyticsService: () => analyticsService, errorHandler: () => errorHandler, queryClient: () => queryClient }
    });

    return { result, card, createTrialCardSetupIntent, confirmTrialCard, queryClient, invalidateQueries, analyticsService, errorHandler };
  }
});
