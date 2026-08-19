import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { DeploymentStatusBadge } from "./DeploymentStatusBadge";

import { render, screen } from "@testing-library/react";

describe("DeploymentStatusBadge", () => {
  it("renders 'Running' for the active state", () => {
    setup({ state: "active" });

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("renders 'Closed' for the closed state", () => {
    setup({ state: "closed" });

    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("falls back to the raw state label for unknown states", () => {
    setup({ state: "paused" });

    expect(screen.getByText("paused")).toBeInTheDocument();
  });

  it("keeps reporting 'Running' while a lease is still live", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "active" })] });

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("treats a lease in its reclamation grace period as still running", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "reclaiming" })] });

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("reports why the lease closed instead of 'Running' when the deployment is still active on chain", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "closed", reason: "lease_closed_reason_decommission" })] });

    expect(screen.getByText("Closed by provider (decommissioned)")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("reports a provider-reclaimed lease whose reason did not classify", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "closed", reason: undefined, group: mock<DeploymentGroup>({ state: "paused" }) })] });

    expect(screen.getByText("Closed by provider")).toBeInTheDocument();
  });

  it("ignores an empty lease list and reports the deployment state", () => {
    setup({ state: "active", leases: [] });

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  function setup(input: { state: string; leases?: LeaseDto[] }) {
    render(<DeploymentStatusBadge state={input.state} leases={input.leases} />);

    return input;
  }
});
