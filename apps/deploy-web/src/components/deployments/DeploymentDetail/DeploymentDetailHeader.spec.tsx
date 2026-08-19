import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentDetailHeader } from "./DeploymentDetailHeader";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentDetailHeader", () => {
  it("shows the number of services reported by the lease status", () => {
    setup({ serviceUris: { web: [], api: [], worker: [] } });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the deployment name from local notes", () => {
    setup({ name: "My Storefront" });

    expect(screen.getByText("My Storefront")).toBeInTheDocument();
  });

  it("falls back to a generated name when none is stored", () => {
    setup({ name: null });

    expect(screen.getByText("Deployment #1786440078202")).toBeInTheDocument();
  });

  it("shows the running status badge when the deployment is active", () => {
    setup({});

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("opens the rename flow when the edit-name button is clicked", async () => {
    const { changeDeploymentName } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Edit deployment name" }));

    expect(changeDeploymentName).toHaveBeenCalledWith("1786440078202");
  });

  it("shows auto top-up as active when enabled for the deployment", () => {
    setup({ autoTopUpEnabled: true });

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows auto top-up as off when disabled for the deployment", () => {
    setup({ autoTopUpEnabled: false });

    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("links to the service URI with a Visit action", () => {
    setup({ serviceUris: { web: ["my-app.akash.app"] } });

    const visit = screen.getByRole("link", { name: "Visit" });
    expect(visit).toHaveAttribute("href", "http://my-app.akash.app");
  });

  it("hides the Visit action when the lease has no status yet", () => {
    setup({ hasLeaseStatus: false });

    expect(screen.queryByRole("link", { name: "Visit" })).not.toBeInTheDocument();
  });

  it("shows the trial badge when the wallet is trialing", () => {
    setup({ isTrialing: true });

    expect(screen.getByText("trial-badge")).toBeInTheDocument();
  });

  it("hides the trial badge when the wallet is not trialing", () => {
    setup({ isTrialing: false });

    expect(screen.queryByText("trial-badge")).not.toBeInTheDocument();
  });

  it("shows the confidential compute and gpu interconnect badges for the declared groups", () => {
    setup({});

    expect(screen.getByText("tee-badge")).toBeInTheDocument();
    expect(screen.getByText("interconnect-badge")).toBeInTheDocument();
  });

  it("redeploys from the locally stored manifest", async () => {
    const { redeploy } = setup({ storedManifest: "version: '2.0'", name: "My Storefront" });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: '2.0'", name: "My Storefront" });
  });

  it("hides the redeploy action when no manifest is stored locally", () => {
    setup({ storedManifest: null });

    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  function setup(input: {
    serviceUris?: Record<string, string[]>;
    autoTopUpEnabled?: boolean;
    hasLeaseStatus?: boolean;
    name?: string | null;
    isTrialing?: boolean;
    storedManifest?: string | null;
  }) {
    const hasLeaseStatus = input.hasLeaseStatus ?? true;
    let leaseStatus: LeaseStatusDto | null = null;
    if (hasLeaseStatus) {
      leaseStatus = mock<LeaseStatusDto>();
      leaseStatus.forwarded_ports = {};
      leaseStatus.services = Object.fromEntries(
        Object.entries(input.serviceUris ?? { web: [] }).map(([name, uris]) => {
          const service = mock<LeaseServiceStatus>();
          service.uris = uris;
          return [name, service];
        })
      );
    }

    const changeDeploymentName = vi.fn();
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () =>
      mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({
        getDeploymentName: () => input.name ?? null,
        changeDeploymentName,
        getDeploymentData: () => (input.storedManifest ? { manifest: input.storedManifest, name: input.name ?? undefined } : null)
      });
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService: mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>() });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false });
    const useDeclaredTeeTypes: typeof DEPENDENCIES.useDeclaredTeeTypes = () => [];
    const useDeclaredGpuInterconnect: typeof DEPENDENCIES.useDeclaredGpuInterconnect = () => ({ enabled: false, fabrics: [] });
    const redeploy = vi.fn();
    const useRedeploy: typeof DEPENDENCIES.useRedeploy = () => redeploy;
    const TrialDeploymentBadge = vi.fn(() => <div>trial-badge</div>);
    const ConfidentialComputeBadge = vi.fn(() => <div>tee-badge</div>);
    const GpuInterconnectBadge = vi.fn(() => <div>interconnect-badge</div>);
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () => mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({ balance: null });
    const useDeploymentSettingQuery: typeof DEPENDENCIES.useDeploymentSettingQuery = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>>({
        data: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>["data"]>>({ autoTopUpEnabled: input.autoTopUpEnabled ?? false })
      });
    const useLeaseStatus: typeof DEPENDENCIES.useLeaseStatus = () => mock<ReturnType<typeof DEPENDENCIES.useLeaseStatus>>({ data: leaseStatus });

    const deployment = mock<DeploymentDto>({
      dseq: "1786440078202",
      state: "active",
      cpuAmount: 2,
      gpuAmount: 0,
      memoryAmount: 536870912,
      storageAmount: 536870912,
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({ state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [] }) })
    });

    render(
      <DeploymentDetailHeader
        deployment={deployment}
        leases={[mock<LeaseDto>({ id: "1", provider: "akash1provider", state: "active" })]}
        providers={[mock<ApiProviderList>({ owner: "akash1provider" })]}
        dependencies={MockComponents(DEPENDENCIES, {
          useLocalNotes,
          useServices,
          useWallet,
          useWalletBalance,
          useDeploymentSettingQuery,
          useDeclaredTeeTypes,
          useDeclaredGpuInterconnect,
          useRedeploy,
          useLeaseStatus,
          TrialDeploymentBadge,
          ConfidentialComputeBadge,
          GpuInterconnectBadge
        })}
      />
    );

    return { changeDeploymentName, redeploy };
  }
});
