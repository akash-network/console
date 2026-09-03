import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { Balances } from "@src/types";
import type { LeaseDto } from "@src/types/deployment";
import { LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import type { DEPENDENCIES } from "./useAccountBalanceOverview";
import { useAccountBalanceOverview } from "./useAccountBalanceOverview";

import { renderHook } from "@testing-library/react";

type WalletSettings = NonNullable<ReturnType<typeof DEPENDENCIES.useWalletSettingsQuery>["data"]>;

describe(useAccountBalanceOverview.name, () => {
  it("splits total into available and escrow", () => {
    const { result } = setup({ totalUsd: 500, escrowUsd: 150 });

    expect(result.current.totalUsd).toBe(500);
    expect(result.current.escrow).toBe(150);
    expect(result.current.available).toBe(350);
  });

  it("never returns negative available", () => {
    const { result } = setup({ totalUsd: 100, escrowUsd: 150 });

    expect(result.current.available).toBe(0);
  });

  it("builds a per-deployment escrow breakdown sorted largest-first", () => {
    const { result } = setup({
      deployments: [
        { dseq: "1", fundsUsd: 50 },
        { dseq: "2", fundsUsd: 100 }
      ],
      names: { "2": "llama-chat" }
    });

    expect(result.current.deployments).toEqual([
      { dseq: "2", name: "llama-chat", escrowUsd: 100, perHourUsd: 0 },
      { dseq: "1", name: "Deployment 1", escrowUsd: 50, perHourUsd: 0 }
    ]);
  });

  it("keeps escrow in sync with the per-deployment breakdown since both come from the same balances", () => {
    const { result } = setup({
      totalUsd: 500,
      deployments: [
        { dseq: "1", fundsUsd: 100 },
        { dseq: "2", fundsUsd: 50 }
      ]
    });

    expect(result.current.escrow).toBe(150);
    expect(result.current.escrow).toBe(result.current.deployments.reduce((sum, deployment) => sum + deployment.escrowUsd, 0));
    expect(result.current.available).toBe(350);
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

  it("loads active and reclaiming leases for spend", () => {
    const { useAllLeases } = setup({ hasLiveLease: true });

    expect(useAllLeases).toHaveBeenCalledWith("akash1abc", expect.objectContaining({ state: LIVE_LEASE_STATES, enabled: true }));
  });

  it("includes reclaiming leases in hourly spend", () => {
    const { result } = setup({
      deployments: [{ dseq: "1", fundsUsd: 200 }],
      leases: [{ dseq: "1", amount: "1000000", state: "reclaiming" }]
    });

    expect(result.current.deployments[0].perHourUsd).toBeGreaterThan(0);
    expect(result.current.perHour).toBeGreaterThan(0);
  });

  it("passes through the auto reload setting", () => {
    const { result } = setup({ autoReloadEnabled: true });

    expect(result.current.autoReloadEnabled).toBe(true);
  });

  it("reports auto reload as off while it is paused after repeated card declines", () => {
    const { result } = setup({ autoReloadEnabled: true, autoReloadPausedAt: "2026-09-01T12:00:00.000Z" });

    expect(result.current.autoReloadEnabled).toBe(false);
  });

  it("hides the auto reload threshold while auto reload is paused", () => {
    const { result } = setup({
      autoReloadMode: "threshold",
      autoReloadEnabled: true,
      autoReloadThreshold: 275,
      autoReloadPausedAt: "2026-09-01T12:00:00.000Z"
    });

    expect(result.current.autoReloadThreshold).toBeNull();
  });

  it("exposes the auto reload threshold in threshold mode when auto reload is on", () => {
    const { result } = setup({ autoReloadMode: "threshold", autoReloadEnabled: true, autoReloadThreshold: 275 });

    expect(result.current.autoReloadThreshold).toBe(275);
  });

  it("hides the auto reload threshold in prediction mode", () => {
    const { result } = setup({ autoReloadMode: "prediction", autoReloadEnabled: true, autoReloadThreshold: 275 });

    expect(result.current.autoReloadThreshold).toBeNull();
  });

  it("hides the auto reload threshold when auto reload is off", () => {
    const { result } = setup({ autoReloadMode: "threshold", autoReloadEnabled: false, autoReloadThreshold: 275 });

    expect(result.current.autoReloadThreshold).toBeNull();
  });

  it("is loading until the balances resolve", () => {
    const { result } = setup({ balancesMissing: true });

    expect(result.current.isLoading).toBe(true);
  });

  it("reports an error instead of loading forever when the balances query fails", () => {
    const { result } = setup({ balancesMissing: true, balancesError: true });

    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("reports an error instead of loading forever when the chain API fallback disables the balances query", () => {
    const { result } = setup({ balancesMissing: true, balancesIdle: true });

    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps showing cached balances when a background refetch fails", () => {
    const { result } = setup({ totalUsd: 500, balancesError: true });

    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.totalUsd).toBe(500);
  });

  it("still resolves balances when the AKT market price is unavailable", () => {
    const { result } = setup({ totalUsd: 500, escrowUsd: 150, priceUnavailable: true });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.totalUsd).toBe(500);
    expect(result.current.available).toBe(350);
  });

  it("nets what the provider earned since settlement off the escrow amount", () => {
    const { result } = setup({
      deployments: [{ dseq: "1", fundsUsd: 100, settledAt: 1000 }],
      leases: [{ dseq: "1", amount: "1000000" }],
      latestBlockHeight: 1050
    });

    expect(result.current.deployments[0].escrowUsd).toBeCloseTo(50, 6);
    expect(result.current.escrow).toBeCloseTo(50, 6);
  });

  it("reports the settled amount for a deployment that settled at the current height", () => {
    const { result } = setup({
      deployments: [{ dseq: "1", fundsUsd: 100, settledAt: 1050 }],
      leases: [{ dseq: "1", amount: "1000000" }],
      latestBlockHeight: 1050
    });

    expect(result.current.deployments[0].escrowUsd).toBe(100);
  });

  it("reports the settled amount for a deployment with no live lease", () => {
    const { result } = setup({
      deployments: [{ dseq: "1", fundsUsd: 100, settledAt: 1000 }],
      leases: [],
      latestBlockHeight: 1050
    });

    expect(result.current.deployments[0].escrowUsd).toBe(100);
  });

  it("reports the settled amount while the latest block height is unknown", () => {
    const { result } = setup({
      deployments: [{ dseq: "1", fundsUsd: 100, settledAt: 1000 }],
      leases: [{ dseq: "1", amount: "1000000" }]
    });

    expect(result.current.deployments[0].escrowUsd).toBe(100);
  });

  it("leaves available untouched by the accrual, since total and escrow both drop by it", () => {
    const settled = setup({
      totalUsd: 500,
      deployments: [{ dseq: "1", fundsUsd: 100, settledAt: 1050 }],
      leases: [{ dseq: "1", amount: "1000000" }],
      latestBlockHeight: 1050
    });
    const accrued = setup({
      totalUsd: 500,
      deployments: [{ dseq: "1", fundsUsd: 100, settledAt: 1000 }],
      leases: [{ dseq: "1", amount: "1000000" }],
      latestBlockHeight: 1050
    });

    expect(accrued.result.current.totalUsd).toBeCloseTo(450, 6);
    expect(accrued.result.current.available).toBeCloseTo(settled.result.current.available, 6);
  });

  it("skips the latest-block poll while the wallet has nothing deployed", () => {
    const { useBlock } = setup({ totalUsd: 500, deployments: [] });

    expect(useBlock).toHaveBeenCalledWith("latest", expect.objectContaining({ enabled: false }));
  });

  it("polls the latest block once the wallet holds an escrow", () => {
    const { useBlock } = setup({ deployments: [{ dseq: "1", fundsUsd: 100, settledAt: 1000 }] });

    expect(useBlock).toHaveBeenCalledWith("latest", expect.objectContaining({ enabled: true }));
  });

  function setup(input: {
    totalUsd?: number;
    escrowUsd?: number;
    deployments?: Array<{ dseq: string; fundsUsd: number; settledAt?: number }>;
    latestBlockHeight?: number;
    names?: Record<string, string>;
    leases?: Array<{ dseq: string; amount?: string; state?: string }>;
    hasLiveLease?: boolean;
    autoReloadEnabled?: boolean;
    autoReloadPausedAt?: string | null;
    autoReloadThreshold?: number;
    autoReloadMode?: "prediction" | "threshold";
    balancesMissing?: boolean;
    balancesError?: boolean;
    balancesIdle?: boolean;
    priceUnavailable?: boolean;
  }) {
    const escrowedDeployments = input.deployments ?? (input.escrowUsd ? [{ dseq: "escrow", fundsUsd: input.escrowUsd }] : []);
    const activeDeployments = escrowedDeployments.map(deployment => ({
      dseq: deployment.dseq,
      escrowAccount: { state: { settled_at: String(deployment.settledAt ?? ""), funds: [{ denom: UAKT_DENOM, amount: String(deployment.fundsUsd) }] } }
    }));
    const escrowTotal = escrowedDeployments.reduce((sum, deployment) => sum + deployment.fundsUsd, 0);

    const balances = Object.assign(mock<Balances>(), {
      balanceUAKT: 0,
      balanceUUSDC: 0,
      balanceUACT: (input.totalUsd ?? 0) - escrowTotal,
      deploymentEscrowUAKT: 0,
      deploymentEscrowUUSDC: 0,
      deploymentEscrowUACT: 0,
      deploymentGrantsUAKT: 0,
      deploymentGrantsUUSDC: 0,
      deploymentGrantsUACT: 0,
      activeDeployments,
      deploymentGrants: []
    });

    const leaseFixtures = input.leases ?? (input.hasLiveLease ? [{ dseq: "live", amount: "1000000" }] : []);
    const leases = leaseFixtures.map(lease =>
      Object.assign(mock<LeaseDto>(), {
        dseq: lease.dseq,
        state: lease.state ?? "active",
        price: { denom: UACT_DENOM, amount: lease.amount ?? "1000000" }
      })
    );

    const useWallet: typeof DEPENDENCIES.useWallet = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWallet>>(), { address: "akash1abc" });

    const udenomToUsd = (amount: string | number) => Number(amount);
    const usePricing: typeof DEPENDENCIES.usePricing = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.usePricing>>(), {
        price: input.priceUnavailable ? undefined : 1,
        isLoaded: !input.priceUnavailable,
        udenomToUsd
      });

    const useAutoReloadMode: typeof DEPENDENCIES.useAutoReloadMode = () => ({
      mode: input.autoReloadMode ?? "prediction",
      showsThresholdRule: input.autoReloadMode === "threshold",
      isLoading: false
    });

    const balancesQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useBalances>>(), {
      data: input.balancesMissing ? undefined : balances,
      isError: input.balancesError ?? false,
      fetchStatus: input.balancesIdle ? ("idle" as const) : ("fetching" as const)
    });
    const useBalances: typeof DEPENDENCIES.useBalances = () => balancesQuery;

    const leasesQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAllLeases>>(), { data: leases });
    const useAllLeases = vi.fn<typeof DEPENDENCIES.useAllLeases>(() => leasesQuery);

    const blockQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useBlock>>(), {
      data: input.latestBlockHeight === undefined ? undefined : { block: { header: { height: String(input.latestBlockHeight) } } }
    });
    const useBlock = vi.fn<typeof DEPENDENCIES.useBlock>(() => blockQuery);

    const walletSettingsQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWalletSettingsQuery>>(), {
      data: Object.assign(mock<WalletSettings>(), {
        autoReloadEnabled: input.autoReloadEnabled ?? false,
        autoReloadPausedAt: input.autoReloadPausedAt ?? null,
        autoReloadMode: input.autoReloadMode ?? ("prediction" as const),
        autoReloadThreshold: input.autoReloadThreshold
      })
    });
    const useWalletSettingsQuery: typeof DEPENDENCIES.useWalletSettingsQuery = () => walletSettingsQuery;

    const getDeploymentName = (dseq: string | number | null) => input.names?.[String(dseq)] ?? null;
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>(), { getDeploymentName });

    const dependencies: typeof DEPENDENCIES = {
      useWallet,
      usePricing,
      useAutoReloadMode,
      useBalances,
      useAllLeases,
      useBlock,
      useWalletSettingsQuery,
      useLocalNotes
    };

    return { ...renderHook(() => useAccountBalanceOverview({ dependencies })), useAllLeases, useBlock };
  }
});
