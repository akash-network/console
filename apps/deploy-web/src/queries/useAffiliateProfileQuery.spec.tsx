import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useAffiliateProfileQuery";
import { useAffiliateProfileQuery } from "./useAffiliateProfileQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useAffiliateProfileQuery.name, () => {
  it("returns the caller's affiliate profile when signed in", async () => {
    const profile = { code: "friendcode", terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 } };
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: profile });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAffiliateProfileQuery({}, { useUser: signedInAs("user-1") }), {
      services: { api: () => api }
    });

    await vi.waitFor(() => {
      expect(getAffiliateProfile).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(profile);
    });
  });

  it("returns null for a signed-in caller who is not an approved affiliate", async () => {
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAffiliateProfileQuery({}, { useUser: signedInAs("user-1") }), {
      services: { api: () => api }
    });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeNull();
    });
  });

  it("skips the request while explicitly disabled, even when signed in", async () => {
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAffiliateProfileQuery({ enabled: false }, { useUser: signedInAs("user-1") }), {
      services: { api: () => api }
    });

    expect(getAffiliateProfile).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("never fetches for a signed-out caller, even though enabled defaults to true", () => {
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: undefined });

    const { result } = setupQuery(() => useAffiliateProfileQuery({}, { useUser }), {
      services: { api: () => api }
    });

    expect(getAffiliateProfile).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("never fetches for a signed-out caller even when the caller passes enabled: true", () => {
    const getAffiliateProfile = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getAffiliateProfile } }) as unknown as ApiService;
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: undefined });

    const { result } = setupQuery(() => useAffiliateProfileQuery({ enabled: true }, { useUser }), {
      services: { api: () => api }
    });

    expect(getAffiliateProfile).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  function signedInAs(userId: string): typeof DEPENDENCIES.useUser {
    return () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { userId } });
  }
});
