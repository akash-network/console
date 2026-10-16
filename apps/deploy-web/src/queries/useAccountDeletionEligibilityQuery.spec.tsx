import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useAccountDeletionEligibilityQuery } from "./useAccountDeletionEligibilityQuery";

import { waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useAccountDeletionEligibilityQuery.name, () => {
  it("unwraps the eligibility from the response envelope", async () => {
    const eligibility = {
      activeDeploymentCount: 0,
      forfeitableBalanceUsd: 12.5,
      isTrialing: false,
      teamsDeletedWithAccount: [{ id: "org-9", name: "Globex", activeDeploymentCount: 0, forfeitableBalanceUsd: 12.5 }],
      teamsToTransfer: []
    };
    const { result, getAccountDeletionEligibility } = setup({ enabled: true, eligibility });

    await waitFor(() => expect(result.current.data).toEqual(eligibility));
    expect(getAccountDeletionEligibility).toHaveBeenCalledOnce();
  });

  it("does not load while disabled", () => {
    const { result, getAccountDeletionEligibility } = setup({ enabled: false });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getAccountDeletionEligibility).not.toHaveBeenCalled();
  });

  function setup(input: { enabled: boolean; eligibility?: unknown }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getAccountDeletionEligibility = vi.fn().mockResolvedValue({ data: input.eligibility });
    const api = createProxy({ v1: { getAccountDeletionEligibility } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAccountDeletionEligibilityQuery({ enabled: input.enabled }), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return { result, getAccountDeletionEligibility };
  }
});
