import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useAffiliateEligibilityQuery";
import { useAffiliateEligibilityQuery } from "./useAffiliateEligibilityQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useAffiliateEligibilityQuery.name, () => {
  it("returns the eligibility with its terms when signed in", async () => {
    const eligibility = { eligible: true, terms: { commissionPercent: 5, commissionMonths: 12 } };
    const { result, getAffiliateEnrollmentEligibility } = setup({ userId: "user-1", response: { data: eligibility } });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(getAffiliateEnrollmentEligibility).toHaveBeenCalled();
    expect(result.current.data).toEqual(eligibility);
  });

  it("skips the request while explicitly disabled", () => {
    const { result, getAffiliateEnrollmentEligibility } = setup({ userId: "user-1", enabled: false });

    expect(getAffiliateEnrollmentEligibility).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("never fetches for a signed-out caller even when enabled", () => {
    const { result, getAffiliateEnrollmentEligibility } = setup({ enabled: true });

    expect(getAffiliateEnrollmentEligibility).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches by default when signed in and no options are passed", async () => {
    const { result, getAffiliateEnrollmentEligibility } = setup({ userId: "user-1" });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(getAffiliateEnrollmentEligibility).toHaveBeenCalledTimes(1);
  });

  function setup(input: { userId?: string; enabled?: boolean; response?: unknown }) {
    const getAffiliateEnrollmentEligibility = vi.fn().mockResolvedValue(input.response ?? { data: { eligible: false } });
    const api = createProxy({ v1: { getAffiliateEnrollmentEligibility } }) as unknown as ApiService;
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.userId ? { userId: input.userId } : undefined });
    const options = input.enabled === undefined ? undefined : { enabled: input.enabled };

    const { result } = setupQuery(() => (options ? useAffiliateEligibilityQuery(options, { useUser }) : useAffiliateEligibilityQuery(undefined, { useUser })), {
      services: { api: () => api }
    });

    return { result, getAffiliateEnrollmentEligibility };
  }
});
