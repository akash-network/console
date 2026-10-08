import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { perBlockToHourly } from "@src/utils/priceUtils";
import type { DEPENDENCIES } from "./useCurrentSpendRate";
import { useCurrentSpendRate } from "./useCurrentSpendRate";

import { renderHook } from "@testing-library/react";

describe(useCurrentSpendRate.name, () => {
  it("sums what every running deployment costs per block and per hour", () => {
    const { result } = setup({ perBlockUsdByDseq: { "1": 1, "2": 1 } });

    expect(result.current.perBlockUsd).toBe(2);
    expect(result.current.perHourUsd).toBeCloseTo(perBlockToHourly(2), 6);
  });

  it("hands on what each deployment costs per block", () => {
    const { result } = setup({ perBlockUsdByDseq: { "1": 1.5, "2": 0.25 } });

    expect(Object.fromEntries(result.current.perBlockUsdByDseq)).toEqual({ "1": 1.5, "2": 0.25 });
  });

  it("follows the spend rate as it changes", () => {
    const { result, rerenderWith } = setup({ perBlockUsdByDseq: { "1": 1 } });

    rerenderWith({ "1": 1, "2": 0.5 });

    expect(Object.fromEntries(result.current.perBlockUsdByDseq)).toEqual({ "1": 1, "2": 0.5 });
    expect(result.current.perBlockUsd).toBe(1.5);
  });

  it("reports no spend while nothing is running", () => {
    const { result } = setup({ perBlockUsdByDseq: {} });

    expect(result.current.perBlockUsd).toBe(0);
    expect(result.current.perHourUsd).toBe(0);
  });

  it("reports no spend before the spend rate has loaded", () => {
    const { result } = setup({ isLoading: true });

    expect(result.current.perBlockUsdByDseq.size).toBe(0);
    expect(result.current.perHourUsd).toBe(0);
  });

  it("asks for the spend rate once the wallet has an address", () => {
    const { useSpendRateQuery } = setup({ perBlockUsdByDseq: {} });

    expect(useSpendRateQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("waits for a wallet address before asking for the spend rate", () => {
    const { useSpendRateQuery } = setup({ perBlockUsdByDseq: {}, address: "" });

    expect(useSpendRateQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("is loading while the spend rate loads", () => {
    const { result } = setup({ isLoading: true });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("reports an error when the spend rate fails to load", () => {
    const { result } = setup({ isError: true });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it("keeps the cached rate when a background refetch fails", () => {
    const { result } = setup({ perBlockUsdByDseq: { "1": 1 }, isError: true });

    expect(result.current.isError).toBe(false);
    expect(result.current.perHourUsd).toBeCloseTo(perBlockToHourly(1), 6);
  });

  function setup(input: { perBlockUsdByDseq?: Record<string, number>; address?: string; isLoading?: boolean; isError?: boolean }) {
    const toMap = (perBlockUsdByDseq: Record<string, number> | undefined) => (perBlockUsdByDseq ? new Map(Object.entries(perBlockUsdByDseq)) : undefined);

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWallet>>(), { address: input.address ?? "akash1abc" });

    const spendRateQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useSpendRateQuery>>(), {
      data: toMap(input.perBlockUsdByDseq),
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false
    });
    const useSpendRateQuery = vi.fn<typeof DEPENDENCIES.useSpendRateQuery>(() => spendRateQuery);

    const hook = renderHook(() => useCurrentSpendRate({ dependencies: { useWallet, useSpendRateQuery } }));
    const rerenderWith = (perBlockUsdByDseq: Record<string, number>) => {
      spendRateQuery.data = toMap(perBlockUsdByDseq);
      hook.rerender();
    };

    return { ...hook, useSpendRateQuery, rerenderWith };
  }
});
