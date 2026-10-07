import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { WorkloadStatus } from "./DeploymentPlacements/placementModel";
import { DEPENDENCIES, DeploymentStatusBadge, getDeploymentStatus } from "./DeploymentStatusBadge";

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

  it("reports a deployment whose close is running in the background as closing", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "active" })], isClosing: true });

    expect(screen.getByText("Closing")).toBeInTheDocument();
  });

  it("drops the reclamation countdown from a deployment that is closing", () => {
    const deadlineInOneDay = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const { CustomTooltip } = setup({
      state: "active",
      leases: [mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: deadlineInOneDay } })],
      isClosing: true
    });

    expect(screen.getByText("Closing")).toBeInTheDocument();
    expect(screen.queryByText("Closes in 24 hours.")).not.toBeInTheDocument();
    expect(CustomTooltip).not.toHaveBeenCalled();
  });

  it("reports a deployment as closed once it is, even before its close is reported done", () => {
    setup({ state: "closed", isClosing: true });

    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("keeps reporting 'Running' while a lease is still live", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "active" })] });

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("reports a lease in its reclamation grace period as reclaiming rather than running", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "reclaiming" })] });

    expect(screen.getByText("Reclaiming")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("reports reclaiming even when another placement is still healthy", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "active" }), mock<LeaseDto>({ state: "reclaiming" })] });

    expect(screen.getByText("Reclaiming")).toBeInTheDocument();
  });

  it("counts the whole deployment down when only one of several placements is being reclaimed", () => {
    const deadlineInOneDay = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    setup({
      state: "active",
      leases: [mock<LeaseDto>({ state: "active" }), mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: deadlineInOneDay } })]
    });

    expect(screen.getByText("Closes in 24 hours.")).toBeInTheDocument();
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

  it("reports a live deployment as starting until its provider reports a ready replica for every service", () => {
    setup({ state: "active", leases: [mock<LeaseDto>({ state: "active" })], workload: "starting" });

    expect(screen.getByText("Starting")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  describe("when summarised", () => {
    it("shortens a provider reason to who closed the lease, keeping the full reason on hover", () => {
      setup({ state: "active", leases: [mock<LeaseDto>({ state: "closed", reason: "lease_closed_reason_decommission" })], isSummarized: true });

      expect(screen.getByText("Closed by provider")).toBeInTheDocument();
      expect(screen.getByText("Closed by provider (decommissioned)")).toBeInTheDocument();
    });

    it("shortens an insufficient funds close to 'Out of funds'", () => {
      setup({ state: "closed", leases: [mock<LeaseDto>({ state: "closed", reason: "lease_closed_reason_insufficient_funds" })], isSummarized: true });

      expect(screen.getByText("Out of funds")).toBeInTheDocument();
    });

    it("leaves a label that needs no shortening without a redundant tooltip", () => {
      const { CustomTooltip } = setup({ state: "active", leases: [mock<LeaseDto>({ state: "active" })], isSummarized: true });

      expect(screen.getByText("Running")).toBeInTheDocument();
      expect(CustomTooltip).not.toHaveBeenCalled();
    });

    it("still names a lease being reclaimed", () => {
      setup({ state: "active", leases: [mock<LeaseDto>({ state: "reclaiming" })], isSummarized: true });

      expect(screen.getByText("Reclaiming")).toBeInTheDocument();
    });

    it("names a provider that is not responding in full, without a tooltip", () => {
      const { CustomTooltip } = setup({ state: "active", leases: [mock<LeaseDto>({ state: "active" })], workload: "unreachable", isSummarized: true });

      expect(screen.getByText("Provider not responding")).toBeInTheDocument();
      expect(CustomTooltip).not.toHaveBeenCalled();
    });

    it("moves how long a reclaimed workload has left onto the badge instead of a second line", () => {
      const deadlineInOneDay = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      setup({ state: "active", leases: [mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: deadlineInOneDay } })], isSummarized: true });

      expect(screen.getByText("Reclaiming")).toBeInTheDocument();
      expect(screen.getByText("Closes in 24 hours.")).toBeInTheDocument();
    });
  });

  describe(getDeploymentStatus.name, () => {
    it("warns instead of alarming when the lease is closed but the deployment is still open", () => {
      const status = getDeploymentStatus("active", [mock<LeaseDto>({ state: "closed", reason: "lease_closed_reason_decommission" })]);

      expect(status.tone).toBe("warning");
    });

    it("alarms when the deployment itself is closed", () => {
      const status = getDeploymentStatus("closed", [mock<LeaseDto>({ state: "closed", reason: undefined })]);

      expect(status.tone).toBe("closed");
    });

    it("reports the provider close over a tenant close when several placements are closed", () => {
      const status = getDeploymentStatus("active", [
        mock<LeaseDto>({ state: "closed", reason: "lease_closed_owner" }),
        mock<LeaseDto>({ state: "closed", reason: "lease_closed_reason_unstable" })
      ]);

      expect(status.label).toBe("Closed by provider (workloads unstable)");
    });

    it("warns while a lease is being reclaimed", () => {
      const status = getDeploymentStatus("active", [mock<LeaseDto>({ state: "reclaiming" })]);

      expect(status.tone).toBe("warning");
    });

    it("reports a running tone while a lease is live", () => {
      const status = getDeploymentStatus("active", [mock<LeaseDto>({ state: "active" })]);

      expect(status.tone).toBe("running");
    });

    it.each([
      { workload: "starting", label: "Starting", tone: "pending" },
      { workload: "loading", label: "Loading", tone: "loading" },
      { workload: "unreachable", label: "Provider not responding", tone: "warning" },
      { workload: "running", label: "Running", tone: "running" }
    ] as const)("reports '$label' for a live lease whose workload is $workload", ({ workload, label, tone }) => {
      const status = getDeploymentStatus("active", [mock<LeaseDto>({ state: "active" })], false, workload);

      expect(status).toEqual({ label, summaryLabel: label, tone });
    });

    it("reports a lease being reclaimed over what its workload is doing", () => {
      const status = getDeploymentStatus("active", [mock<LeaseDto>({ state: "reclaiming" })], false, "starting");

      expect(status.label).toBe("Reclaiming");
    });

    it("reports a close running in the background over what the workload is doing", () => {
      const status = getDeploymentStatus("active", [mock<LeaseDto>({ state: "active" })], true, "starting");

      expect(status.label).toBe("Closing");
    });

    it("ignores the workload of a deployment that is closed", () => {
      const status = getDeploymentStatus("closed", [], false, "starting");

      expect(status).toEqual({ label: "Closed", summaryLabel: "Closed", tone: "closed" });
    });
  });

  function setup(input: { state: string; leases?: LeaseDto[]; isSummarized?: boolean; isClosing?: boolean; workload?: WorkloadStatus }) {
    const CustomTooltip = vi.fn<typeof DEPENDENCIES.CustomTooltip>(({ title, children }) => (
      <>
        {title}
        {children}
      </>
    ));

    render(
      <DeploymentStatusBadge
        state={input.state}
        leases={input.leases}
        isSummarized={input.isSummarized}
        isClosing={input.isClosing}
        workload={input.workload}
        dependencies={{ ...DEPENDENCIES, CustomTooltip }}
      />
    );

    return { ...input, CustomTooltip };
  }
});
