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
    const { result, getAccountDeletionEligibility } = setup({ eligibility });

    await waitFor(() => expect(result.current.data).toEqual(eligibility));
    expect(getAccountDeletionEligibility).toHaveBeenCalledOnce();
  });

  function setup(input: { eligibility?: unknown }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getAccountDeletionEligibility = vi.fn().mockResolvedValue({ data: input.eligibility });
    const api = createProxy({ v1: { getAccountDeletionEligibility } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAccountDeletionEligibilityQuery(), {
      services: { api: () => api, queryClient: () => queryClient }
    });

    return { result, getAccountDeletionEligibility };
  }
});
