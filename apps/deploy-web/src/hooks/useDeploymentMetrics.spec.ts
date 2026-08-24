import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useDeploymentMetrics";
import { useDeploymentMetrics } from "./useDeploymentMetrics";

import { renderHook } from "@testing-library/react";

describe("useDeploymentMetrics", () => {
  it("sums the price of every live lease", () => {
    const { result } = setup({
      leases: [
        { state: "active", amount: "100" },
        { state: "reclaiming", amount: "25" }
      ]
    });

    expect(result.current.deploymentCost).toBe(125);
  });

  it("ignores a lease an earlier provider closed on a re-leased deployment", () => {
    const { result } = setup({
      leases: [
        { state: "closed", amount: "900" },
        { state: "active", amount: "100" }
      ]
    });

    expect(result.current.deploymentCost).toBe(100);
  });

  it("reports no cost for a deployment with no lease", () => {
    const { result } = setup({ leases: [] });

    expect(result.current.deploymentCost).toBe(0);
  });

  it("projects the runway from the live burn rate alone", () => {
    const { useRealTimeLeft } = setup({
      leases: [
        { state: "closed", amount: "900" },
        { state: "active", amount: "100" }
      ]
    });

    expect(useRealTimeLeft).toHaveBeenCalledWith(100, 2000000, 500, 400);
  });

  function setup(input: { leases: Array<{ state: string; amount: string }> }) {
    const deployment = mock<DeploymentDto>({
      escrowBalance: 2000000,
      createdAt: 400,
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({
        state: mock<DeploymentDto["escrowAccount"]["state"]>({ settled_at: "500" })
      })
    });
    const leases = input.leases.map(lease => mock<LeaseDto>({ state: lease.state, price: { denom: "uact", amount: lease.amount } }));
    const useRealTimeLeft = vi.fn<typeof DEPENDENCIES.useRealTimeLeft>();

    const rendered = renderHook(() => useDeploymentMetrics({ deployment, leases, dependencies: { useRealTimeLeft } }));

    return { ...rendered, useRealTimeLeft };
  }
});
