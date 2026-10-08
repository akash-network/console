import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { useAffiliateProfileQuery } from "./useAffiliateProfileQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useAffiliateProfileQuery.name, () => {
  it("returns the caller's affiliate profile", async () => {
    const profile = { code: "friendcode", terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 } };
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: profile });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAffiliateProfileQuery(), {
      services: { api: () => api }
    });

    await vi.waitFor(() => {
      expect(getAffiliateProfile).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(profile);
    });
  });

  it("returns null for a caller who is not an approved affiliate", async () => {
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAffiliateProfileQuery(), {
      services: { api: () => api }
    });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeNull();
    });
  });

  it("skips the request while disabled", async () => {
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAffiliateProfileQuery({ enabled: false }), {
      services: { api: () => api }
    });

    expect(getAffiliateProfile).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
