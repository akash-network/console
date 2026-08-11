import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentDetailHeader } from "./DeploymentDetailHeader";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentDetailHeader", () => {
  it("shows the number of services reported by the lease status", () => {
    setup({ serviceUris: { web: [], api: [], worker: [] } });

    expect(screen.getByText("3")).toBeInTheDocument();
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

  function setup(input: { serviceUris?: Record<string, string[]>; autoTopUpEnabled?: boolean; hasLeaseStatus?: boolean }) {
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

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        deploymentLocalStorage: mock<ReturnType<typeof DEPENDENCIES.useServices>["deploymentLocalStorage"]>({ get: () => null })
      });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1test" });
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

    return render(
      <DeploymentDetailHeader
        deployment={deployment}
        leases={[mock<LeaseDto>({ id: "1", provider: "akash1provider", state: "active" })]}
        providers={[mock<ApiProviderList>({ owner: "akash1provider" })]}
        dependencies={MockComponents(DEPENDENCIES, {
          useServices,
          useWallet,
          useWalletBalance,
          useDeploymentSettingQuery,
          useLeaseStatus
        })}
      />
    );
  }
});
