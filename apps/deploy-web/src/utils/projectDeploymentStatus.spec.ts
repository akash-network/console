import { describe, expect, it } from "vitest";

import type { ListedDeploymentStates } from "./projectDeploymentStatus";
import { toProjectDeploymentStatus } from "./projectDeploymentStatus";

describe(toProjectDeploymentStatus.name, () => {
  it("reports a closed deployment as closed whatever its leases say", () => {
    expect(toProjectDeploymentStatus(listed({ deployment: { state: "closed" }, leases: [{ state: "active" }] }))).toBe("closed");
  });

  it("reports a deployment with a lease in its reclamation window as reclaiming", () => {
    expect(toProjectDeploymentStatus(listed({ leases: [{ state: "active" }, { state: "reclaiming" }] }))).toBe("reclaiming");
  });

  it("reports an open deployment without a lease yet as spinning up", () => {
    expect(toProjectDeploymentStatus(listed({ leases: [] }))).toBe("spinning");
  });

  it("reports an open deployment whose leases are all dead as degraded", () => {
    expect(toProjectDeploymentStatus(listed({ leases: [{ state: "closed" }, { state: "insufficient_funds" }] }))).toBe("degraded");
  });

  it("reports an open deployment with an overdrawn escrow as degraded", () => {
    expect(toProjectDeploymentStatus(listed({ leases: [{ state: "active" }], escrow_account: { state: { state: "overdrawn" } } }))).toBe("degraded");
  });

  it("reports an open deployment with a live lease and funded escrow as running", () => {
    expect(toProjectDeploymentStatus(listed({ leases: [{ state: "active" }], escrow_account: { state: { state: "open" } } }))).toBe("running");
  });

  function listed(overrides: Partial<ListedDeploymentStates>): ListedDeploymentStates {
    return { deployment: { state: "active" }, leases: [], ...overrides };
  }
});
