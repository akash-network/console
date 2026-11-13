import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { useReferralCodeQuery } from "./useReferralCodeQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useReferralCodeQuery.name, () => {
  it("returns the check result for the given code", async () => {
    const { getReferralCode, result } = setup({ code: "friendcode", response: { data: { valid: true, trialCreditsUsd: 5 } } });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(getReferralCode).toHaveBeenCalledWith({ code: "friendcode" });
    expect(result.current.data).toEqual({ valid: true, trialCreditsUsd: 5 });
  });

  it("skips the request when there is no code", () => {
    const { getReferralCode, result } = setup({ code: undefined, response: { data: { valid: false } } });

    expect(getReferralCode).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  function setup(input: { code: string | undefined; response: { data: { valid: boolean; trialCreditsUsd?: number } } }) {
    const getReferralCode = vi.fn().mockResolvedValue(input.response);
    const api = createProxy({ v1: { getReferralCode } }) as unknown as ApiService;

    const { result } = setupQuery(() => useReferralCodeQuery(input.code), {
      services: { api: () => api }
    });

    return { getReferralCode, result };
  }
});
