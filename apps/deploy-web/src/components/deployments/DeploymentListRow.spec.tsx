import { describe, expect, it } from "vitest";

import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { getClosedLeaseLabel } from "./DeploymentListRow";

describe("getClosedLeaseLabel", () => {
  it("returns the specific provider reason for a reclaimed lease", () => {
    expect(getClosedLeaseLabel(createClosedLease({ reason: "lease_closed_reason_unstable" }))).toBe("Closed by provider (workloads unstable)");
  });

  it("returns 'Closed by provider' for a reclaimed (paused) lease whose reason did not classify", () => {
    expect(getClosedLeaseLabel(createClosedLease({ reason: undefined, groupState: "paused" }))).toBe("Closed by provider");
  });

  it("returns tenant copy for a self-closed lease", () => {
    expect(getClosedLeaseLabel(createClosedLease({ reason: "lease_closed_owner" }))).toBe("Closed by you");
  });

  it("returns a generic label for an unknown reason with no reclamation evidence", () => {
    expect(getClosedLeaseLabel(createClosedLease({ reason: undefined }))).toBe("Closed");
  });

  function createClosedLease(overrides: { reason?: string; groupState?: string }): LeaseDto {
    return {
      id: "1",
      owner: "owner1",
      provider: "provider1",
      dseq: "123",
      gseq: 1,
      oseq: 1,
      state: "closed",
      price: { denom: "uakt", amount: "100" },
      cpuAmount: 0,
      memoryAmount: 0,
      storageAmount: 0,
      reason: overrides.reason,
      group: { state: overrides.groupState ?? "open" } as DeploymentGroup
    } as LeaseDto;
  }
});
