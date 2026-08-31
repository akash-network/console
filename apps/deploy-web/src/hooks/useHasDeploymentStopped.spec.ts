import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { useHasDeploymentStopped } from "./useHasDeploymentStopped";

import { renderHook } from "@testing-library/react";

describe(useHasDeploymentStopped.name, () => {
  it("reports a closed deployment as stopped", () => {
    const { result } = setup({ state: "closed", leaseStates: ["active"] });

    expect(result.current).toBe(true);
  });

  it("reports an open deployment whose leases have all closed as stopped", () => {
    const { result } = setup({ state: "active", leaseStates: ["closed"] });

    expect(result.current).toBe(true);
  });

  it("reports an open deployment with a live lease as running", () => {
    const { result } = setup({ state: "active", leaseStates: ["active"] });

    expect(result.current).toBe(false);
  });

  it("reports an open deployment with no leases at all as stopped", () => {
    const { result } = setup({ state: "active", leaseStates: [] });

    expect(result.current).toBe(true);
  });

  it("withholds judgement while the lease query is still in flight", () => {
    expect(setup({ state: "active", leaseStates: null }).result.current).toBe(false);
    expect(setup({ state: "active", leaseStates: undefined }).result.current).toBe(false);
  });

  function setup(input: { state: string; leaseStates: string[] | null | undefined }) {
    const deployment = mock<DeploymentDto>({ state: input.state });
    const leases = input.leaseStates?.map(state => mock<LeaseDto>({ state }));

    return renderHook(() => useHasDeploymentStopped({ deployment, leases: input.leaseStates === null ? null : leases }));
  }
});
