import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useTrialCardQuery";
import { useTrialCardQuery } from "./useTrialCardQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useTrialCardQuery.name, () => {
  it("returns the card step of a signed-in user who is still waiting for a wallet", async () => {
    const { result, getTrialCard } = setup({ step: "required" });

    await vi.waitFor(() => {
      expect(result.current.data).toBe("required");
    });
    expect(getTrialCard).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "the card step is switched off", input: { isCardStepEnabled: false } },
    { name: "nobody is signed in", input: { userId: undefined } },
    { name: "the email is not confirmed yet", input: { emailVerified: false } },
    { name: "the user already has a wallet", input: { hasWallet: true } },
    { name: "the wallet lookup failed", input: { isWalletLookupFailed: true } }
  ])("asks nothing while $name", ({ input }) => {
    const { result, getTrialCard } = setup({ step: "required", ...input });

    expect(getTrialCard).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("settles on an error without asking again when the request fails", async () => {
    const { result, getTrialCard } = setup({ failure: new Error("unavailable") });

    await vi.waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(getTrialCard).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  function setup(input: {
    step?: "not_required" | "required" | "verified";
    failure?: Error;
    isCardStepEnabled?: boolean;
    userId?: string;
    emailVerified?: boolean;
    hasWallet?: boolean;
    isWalletLookupFailed?: boolean;
  }) {
    const getTrialCard = input.failure ? vi.fn().mockRejectedValue(input.failure) : vi.fn().mockResolvedValue({ data: { step: input.step } });
    const api = createProxy({ v1: { getTrialCard } }) as unknown as ApiService;
    const userId = "userId" in input ? input.userId : "user-1";
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: userId ? { userId, emailVerified: input.emailVerified ?? true } : undefined }),
      useWallet: () =>
        mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ hasWallet: input.hasWallet ?? false, isWalletLookupFailed: input.isWalletLookupFailed ?? false }),
      useFlag: flag => flag === "trial_card_step" && (input.isCardStepEnabled ?? true)
    };

    const { result } = setupQuery(() => useTrialCardQuery(dependencies), { services: { api: () => api } });

    return { result, getTrialCard };
  }
});
