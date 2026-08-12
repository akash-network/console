import { describe, expect, it } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { DEPENDENCIES, useAccountBalanceOverview } from "./useAccountBalanceOverview";

import { renderHook } from "@testing-library/react";

describe(useAccountBalanceOverview.name, () => {
  it("splits total into available and reserved", () => {
    const { result } = setup({ totalUsd: 500, reservedUsd: 150 });

    expect(result.current.totalUsd).toBe(500);
    expect(result.current.reserved).toBe(150);
    expect(result.current.available).toBe(350);
  });

  it("never returns negative available", () => {
    const { result } = setup({ totalUsd: 100, reservedUsd: 150 });

    expect(result.current.available).toBe(0);
  });

  it("builds a per-deployment reserved breakdown sorted largest-first", () => {
    const { result } = setup({
      deployments: [
        { dseq: "1", fundsUsd: 50 },
        { dseq: "2", fundsUsd: 100 }
      ],
      names: { "2": "llama-chat" }
    });

    expect(result.current.deployments).toEqual([
      { dseq: "2", name: "llama-chat", reservedUsd: 100, perHourUsd: 0 },
      { dseq: "1", name: "Deployment 1", reservedUsd: 50, perHourUsd: 0 }
    ]);
    expect(result.current.activeDeploymentCount).toBe(2);
  });

  it("reports runway when deployments are actively spending", () => {
    const { result } = setup({ totalUsd: 500, hasLiveLease: true });

    expect(result.current.runwayDays).toEqual(expect.any(Number));
    expect(result.current.runwayDays).toBeGreaterThanOrEqual(0);
    expect(result.current.lastsUntil).toBeInstanceOf(Date);
  });

  it("has no runway when nothing is being spent", () => {
    const { result } = setup({ totalUsd: 500, hasLiveLease: false });

    expect(result.current.runwayDays).toBeNull();
    expect(result.current.lastsUntil).toBeNull();
  });

  it("computes each deployment's hourly burn rate from its live leases", () => {
    const { result } = setup({
      deployments: [
        { dseq: "1", fundsUsd: 200 },
        { dseq: "2", fundsUsd: 100 }
      ],
      leases: [{ dseq: "1", amount: "1000000" }]
    });

    expect(result.current.deployments[0].perHourUsd).toBeGreaterThan(0);
    expect(result.current.deployments[1].perHourUsd).toBe(0);
  });

  it("passes through the auto reload setting", () => {
    const { result } = setup({ autoReloadEnabled: true });

    expect(result.current.autoReloadEnabled).toBe(true);
  });

  it("exposes the auto reload threshold when the fixed-threshold flag and auto reload are both on", () => {
    const { result } = setup({ fixedThresholdEnabled: true, autoReloadEnabled: true, autoReloadThreshold: 275 });

    expect(result.current.autoReloadThreshold).toBe(275);
  });

  it("hides the auto reload threshold when the fixed-threshold flag is off", () => {
    const { result } = setup({ fixedThresholdEnabled: false, autoReloadEnabled: true, autoReloadThreshold: 275 });

    expect(result.current.autoReloadThreshold).toBeNull();
  });

  it("hides the auto reload threshold when auto reload is off", () => {
    const { result } = setup({ fixedThresholdEnabled: true, autoReloadEnabled: false, autoReloadThreshold: 275 });

    expect(result.current.autoReloadThreshold).toBeNull();
  });

  it("is loading until the wallet balance resolves", () => {
    const { result } = setup({ walletBalanceMissing: true });

    expect(result.current.isLoading).toBe(true);
  });

  function setup(input: {
    totalUsd?: number;
    reservedUsd?: number;
    deployments?: Array<{ dseq: string; fundsUsd: number }>;
    names?: Record<string, string>;
    leases?: Array<{ dseq: string; amount?: string }>;
    hasLiveLease?: boolean;
    autoReloadEnabled?: boolean;
    autoReloadThreshold?: number;
    fixedThresholdEnabled?: boolean;
    walletBalanceMissing?: boolean;
  }) {
    const activeDeployments = (input.deployments ?? []).map(deployment => ({
      dseq: deployment.dseq,
      escrowAccount: { state: { funds: [{ denom: UAKT_DENOM, amount: String(deployment.fundsUsd) }] } }
    }));

    const leases = input.leases
      ? input.leases.map(lease => ({ dseq: lease.dseq, state: "active", price: { denom: UACT_DENOM, amount: lease.amount ?? "1000000" } }))
      : input.hasLiveLease
        ? [{ state: "active", price: { denom: UACT_DENOM, amount: "1000000" } }]
        : [];

    const dependencies = {
      ...DEPENDENCIES,
      useWallet: () => ({ address: "akash1abc" }),
      usePricing: () => ({ price: 1, isLoaded: true, udenomToUsd: (amount: string | number) => Number(amount) }),
      useFlag: () => input.fixedThresholdEnabled ?? false,
      useWalletBalance: () => ({
        balance: input.walletBalanceMissing ? null : { totalUsd: input.totalUsd ?? 0, totalDeploymentEscrowUSD: input.reservedUsd ?? 0 },
        isLoading: false,
        refetch: () => undefined
      }),
      useBalances: () => ({ data: { activeDeployments } }),
      useAllLeases: () => ({ data: leases }),
      useWalletSettingsQuery: () => ({ data: { autoReloadEnabled: input.autoReloadEnabled ?? false, autoReloadThreshold: input.autoReloadThreshold } }),
      useLocalNotes: () => ({ getDeploymentName: (dseq: string | number | null) => input.names?.[String(dseq)] ?? null })
    } as unknown as typeof DEPENDENCIES;

    return renderHook(() => useAccountBalanceOverview({ dependencies }));
  }
});
