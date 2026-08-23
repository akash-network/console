import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useDeploymentEscrowBalance";
import { useDeploymentEscrowBalance } from "./useDeploymentEscrowBalance";

import { renderHook } from "@testing-library/react";

describe(useDeploymentEscrowBalance.name, () => {
  it("reports the live draining balance for an active deployment with a live lease", () => {
    const { result } = setup({ state: "active", escrowBalance: 2000000, realTimeLeftEscrow: 500000, leaseState: "active" });

    expect(result.current.balanceUdenom).toBe(500000);
  });

  it("reports the settled balance when no lease is live", () => {
    const { result } = setup({ state: "active", escrowBalance: 2000000, realTimeLeftEscrow: 500000, leaseState: "closed" });

    expect(result.current.balanceUdenom).toBe(2000000);
  });

  it("reports the settled balance for a closed deployment", () => {
    const { result } = setup({ state: "closed", escrowBalance: 2000000, realTimeLeftEscrow: 500000, leaseState: "active" });

    expect(result.current.balanceUdenom).toBe(2000000);
  });

  it("reports the settled balance when the metrics have no live figure yet", () => {
    const { result } = setup({ state: "active", escrowBalance: 2000000, leaseState: "active" });

    expect(result.current.balanceUdenom).toBe(2000000);
  });

  it("reports the escrow account's denom", () => {
    const { result } = setup({ state: "active", escrowBalance: 2000000, leaseState: "active" });

    expect(result.current.denom).toBe("uact");
  });

  function setup(input: { state: string; escrowBalance: number; realTimeLeftEscrow?: number; leaseState: string }) {
    const deployment = mock<DeploymentDto>({
      dseq: "1786440078202",
      state: input.state,
      escrowBalance: input.escrowBalance,
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({
        state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [{ denom: "uact", amount: String(input.escrowBalance) }] })
      })
    });
    const leases = [mock<LeaseDto>({ id: "1", state: input.leaseState })];

    const useDeploymentMetrics: typeof DEPENDENCIES.useDeploymentMetrics = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentMetrics>>({
        realTimeLeft: input.realTimeLeftEscrow !== undefined ? { timeLeft: new Date(), escrow: input.realTimeLeftEscrow, amountSpent: 0 } : undefined
      });

    return renderHook(() => useDeploymentEscrowBalance({ deployment, leases, dependencies: { useDeploymentMetrics } }));
  }
});
