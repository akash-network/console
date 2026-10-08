import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useReferralQuery";
import { useReferralQuery } from "./useReferralQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useReferralQuery.name, () => {
  it("returns the caller's referral trial credits when signed in", async () => {
    const referral = { trialCreditsUsd: 5 };
    const getReferral = vi.fn().mockResolvedValue({ data: referral });
    const api = createProxy({ v1: { getReferral } }) as unknown as ApiService;

    const { result } = setupQuery(() => useReferralQuery({}, { useUser: signedInAs("user-1") }), {
      services: { api: () => api }
    });

    await vi.waitFor(() => {
      expect(getReferral).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(referral);
    });
  });

  it("returns null for a signed-in caller who was never referred", async () => {
    const getReferral = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getReferral } }) as unknown as ApiService;

    const { result } = setupQuery(() => useReferralQuery({}, { useUser: signedInAs("user-1") }), {
      services: { api: () => api }
    });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeNull();
    });
  });

  it("skips the request while explicitly disabled, even when signed in", async () => {
    const getReferral = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getReferral } }) as unknown as ApiService;

    const { result } = setupQuery(() => useReferralQuery({ enabled: false }, { useUser: signedInAs("user-1") }), {
      services: { api: () => api }
    });

    expect(getReferral).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("never fetches for a signed-out caller, even though enabled defaults to true", () => {
    const getReferral = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getReferral } }) as unknown as ApiService;
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: undefined });

    const { result } = setupQuery(() => useReferralQuery({}, { useUser }), {
      services: { api: () => api }
    });

    expect(getReferral).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("never fetches for a signed-out caller even when the caller passes enabled: true", () => {
    const getReferral = vi.fn().mockResolvedValue({ data: null });
    const api = createProxy({ v1: { getReferral } }) as unknown as ApiService;
    const useUser: typeof DEPENDENCIES.useUser = () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: undefined });

    const { result } = setupQuery(() => useReferralQuery({ enabled: true }, { useUser }), {
      services: { api: () => api }
    });

    expect(getReferral).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  function signedInAs(userId: string): typeof DEPENDENCIES.useUser {
    return () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { userId } });
  }
});
