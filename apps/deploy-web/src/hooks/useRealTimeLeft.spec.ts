import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useRealTimeLeft";
import { useRealTimeLeft } from "./useRealTimeLeft";

import { renderHook } from "@testing-library/react";

describe(useRealTimeLeft.name, () => {
  it("drains the escrow by what the provider earned since the last settlement", () => {
    const { result } = setup({ pricePerBlock: 100, balance: 50_000, settledAt: 1000, latestBlockHeight: 1100 });

    expect(result.current?.escrow).toBe(40_000);
  });

  it("reports the settled escrow when no lease is spending", () => {
    const { result } = setup({ pricePerBlock: 0, balance: 50_000, settledAt: 1000, latestBlockHeight: 1100 });

    expect(result.current?.escrow).toBe(50_000);
  });

  it("clamps the escrow at zero once the accrued spend exceeds the balance", () => {
    const { result } = setup({ pricePerBlock: 100, balance: 5_000, settledAt: 1000, latestBlockHeight: 1100 });

    expect(result.current?.escrow).toBe(0);
  });

  it("counts what was spent since creation, capped at the balance", () => {
    const { result } = setup({ pricePerBlock: 100, balance: 50_000, settledAt: 1000, latestBlockHeight: 1100 });

    expect(result.current?.amountSpent).toBe(20_000);
  });

  it("reports nothing until the latest height is known", () => {
    const { result } = setup({ pricePerBlock: 100, balance: 50_000, settledAt: 1000, latestBlockHeight: undefined });

    expect(result.current).toBeUndefined();
  });

  function setup(input: { pricePerBlock: number; balance: number; settledAt: number; latestBlockHeight: number | undefined }) {
    const useLatestBlockHeight = vi.fn<typeof DEPENDENCIES.useLatestBlockHeight>(() => input.latestBlockHeight);

    return renderHook(() => useRealTimeLeft(input.pricePerBlock, input.balance, input.settledAt, 900, { useLatestBlockHeight }));
  }
});
