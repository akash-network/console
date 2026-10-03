import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UACT_DENOM } from "@src/config/denom.config";
import type { LeaseDto } from "@src/types/deployment";
import { LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import { perBlockToHourly } from "@src/utils/priceUtils";
import type { DEPENDENCIES } from "./useCurrentSpendRate";
import { useCurrentSpendRate } from "./useCurrentSpendRate";

import { renderHook } from "@testing-library/react";

describe(useCurrentSpendRate.name, () => {
  it("sums the hourly cost of every live lease", () => {
    const { result } = setup({
      leases: [
        { dseq: "1", amount: "1000000" },
        { dseq: "2", amount: "1000000", state: "reclaiming" }
      ]
    });

    expect(result.current.perBlockUsd).toBe(2);
    expect(result.current.perHourUsd).toBeCloseTo(perBlockToHourly(2), 6);
  });

  it("leaves closed leases out of the rate", () => {
    const { result } = setup({
      leases: [
        { dseq: "1", amount: "1000000" },
        { dseq: "2", amount: "1000000", state: "closed" }
      ]
    });

    expect(result.current.perHourUsd).toBeCloseTo(perBlockToHourly(1), 6);
  });

  it("groups the per-block cost by deployment", () => {
    const { result } = setup({
      leases: [
        { dseq: "1", amount: "1000000" },
        { dseq: "1", amount: "500000" },
        { dseq: "2", amount: "250000" }
      ]
    });

    expect(Object.fromEntries(result.current.perBlockUsdByDseq)).toEqual({ "1": 1.5, "2": 0.25 });
  });

  it("follows the leases as they change", () => {
    const { result, rerenderWith } = setup({ leases: [{ dseq: "1", amount: "1000000" }] });

    rerenderWith([
      { dseq: "1", amount: "1000000" },
      { dseq: "2", amount: "500000" }
    ]);

    expect(Object.fromEntries(result.current.perBlockUsdByDseq)).toEqual({ "1": 1, "2": 0.5 });
    expect(result.current.perBlockUsd).toBe(1.5);
  });

  it("reports no spend while nothing is running", () => {
    const { result } = setup({ leases: [] });

    expect(result.current.perHourUsd).toBe(0);
  });

  it("loads the wallet's active and reclaiming leases", () => {
    const { useAllLeases } = setup({ leases: [] });

    expect(useAllLeases).toHaveBeenCalledWith("akash1abc", expect.objectContaining({ state: LIVE_LEASE_STATES, enabled: true }));
  });

  it("waits for a wallet address before loading leases", () => {
    const { useAllLeases } = setup({ leases: [], address: "" });

    expect(useAllLeases).toHaveBeenCalledWith("", expect.objectContaining({ enabled: false }));
  });

  it("is loading while the leases load", () => {
    const { result } = setup({ leasesLoading: true });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("reports an error when the leases fail to load", () => {
    const { result } = setup({ leasesError: true });

    expect(result.current.isError).toBe(true);
  });

  it("keeps the cached rate when a background refetch fails", () => {
    const { result } = setup({ leases: [{ dseq: "1", amount: "1000000" }], leasesError: true });

    expect(result.current.isError).toBe(false);
    expect(result.current.perHourUsd).toBeCloseTo(perBlockToHourly(1), 6);
  });

  function setup(input: {
    leases?: Array<{ dseq: string; amount: string; state?: string }>;
    address?: string;
    leasesLoading?: boolean;
    leasesError?: boolean;
  }) {
    const buildLeases = (fixtures: typeof input.leases) =>
      fixtures?.map(lease =>
        Object.assign(mock<LeaseDto>(), {
          dseq: lease.dseq,
          state: lease.state ?? "active",
          price: { denom: UACT_DENOM, amount: lease.amount }
        })
      );

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWallet>>(), { address: input.address ?? "akash1abc" });

    const leasesQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAllLeases>>(), {
      data: buildLeases(input.leases),
      isLoading: input.leasesLoading ?? false,
      isError: input.leasesError ?? false
    });
    const useAllLeases = vi.fn<typeof DEPENDENCIES.useAllLeases>(() => leasesQuery);

    const hook = renderHook(() => useCurrentSpendRate({ dependencies: { useWallet, useAllLeases } }));
    const rerenderWith = (fixtures: NonNullable<typeof input.leases>) => {
      leasesQuery.data = buildLeases(fixtures);
      hook.rerender();
    };

    return { ...hook, useAllLeases, rerenderWith };
  }
});
