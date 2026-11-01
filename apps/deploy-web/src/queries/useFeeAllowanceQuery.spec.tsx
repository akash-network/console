import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { useFeeAllowanceExistenceQuery } from "./useFeeAllowanceQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useFeeAllowanceExistenceQuery.name, () => {
  it("returns true when the wallet holds a valid fee allowance", async () => {
    const { result } = setup({ allowances: [{ granter: "akash1granter", spendLimit: [], expiration: null }] });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(true);
  });

  it("returns false when the wallet holds no valid fee allowance", async () => {
    const { result, listFeeAllowances } = setup({ allowances: [] });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(false);
    expect(listFeeAllowances).toHaveBeenCalledOnce();
  });

  it("does not look anything up when disabled", () => {
    const { listFeeAllowances } = setup({ allowances: [], enabled: false });

    expect(listFeeAllowances).not.toHaveBeenCalled();
  });

  function setup(input: { allowances: { granter: string; spendLimit: { denom: string; amount: string }[]; expiration: string | null }[]; enabled?: boolean }) {
    const listFeeAllowances = vi.fn().mockResolvedValue({ data: input.allowances });
    const api = createProxy({ v1: { listFeeAllowances } }) as unknown as ApiService;

    const { result } = setupQuery(() => useFeeAllowanceExistenceQuery("akash1grantee", { enabled: input.enabled }), {
      services: { api: () => api }
    });

    return { result, listFeeAllowances };
  }
});
