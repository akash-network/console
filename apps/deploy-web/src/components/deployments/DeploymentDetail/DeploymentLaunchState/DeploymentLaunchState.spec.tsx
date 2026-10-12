import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentLaunch } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentLaunchState } from "./DeploymentLaunchState";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const PROVIDER = "akash1provider";

describe(DeploymentLaunchState.name, () => {
  describe("while the lease is being created", () => {
    it("says the deployment is spinning up and that its services are starting", () => {
      setup({ launch: { phase: "awaiting-lease", providers: [PROVIDER] } });

      expect(screen.getByRole("region", { name: "Deployment spinning up" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Spinning up" })).toBeInTheDocument();
      expect(screen.getByText(/Its services are starting/)).toBeInTheDocument();
    });

    it("names the provider and the region it is going to", () => {
      setup({
        launch: { phase: "awaiting-lease", providers: [PROVIDER] },
        providers: [mock<ApiProviderList>({ owner: PROVIDER, organization: "Acme Cloud", attributes: [], locationRegion: "us-west" })]
      });

      expect(screen.getByText("Acme Cloud")).toBeInTheDocument();
      expect(screen.getByText("us-west")).toBeInTheDocument();
    });

    it("names a provider whose region it cannot tell without one", () => {
      setup({
        launch: { phase: "awaiting-lease", providers: [PROVIDER] },
        providers: [mock<ApiProviderList>({ owner: PROVIDER, organization: "Acme Cloud", attributes: [], locationRegion: undefined })]
      });

      expect(screen.getByRole("listitem")).toHaveTextContent(/^Acme Cloud$/);
    });

    it("falls back to the provider's address until the provider is looked up", () => {
      setup({ launch: { phase: "awaiting-lease", providers: [PROVIDER] }, providers: [mock<ApiProviderList>({ owner: "akash1other" })] });

      expect(screen.getByText(PROVIDER)).toBeInTheDocument();
    });

    it("looks up the providers the lease is being created with", () => {
      const { useProvidersByAddresses } = setup({ launch: { phase: "awaiting-lease", providers: [PROVIDER, "akash1second"] } });

      expect(useProvidersByAddresses).toHaveBeenCalledWith([PROVIDER, "akash1second"]);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("offers no way out while the lease is still underway", () => {
      const { DeploymentRecoveryAction } = setup({ launch: { phase: "awaiting-lease", providers: [PROVIDER] } });

      expect(DeploymentRecoveryAction).not.toHaveBeenCalled();
    });
  });

  describe("once the lease failed", () => {
    it("says why and offers to choose a provider again", () => {
      const leases: LeaseDto[] = [];
      const { DeploymentRecoveryAction } = setup({
        launch: { phase: "failed", providers: [PROVIDER], hasLease: false, reason: "Not enough credits to create this lease" },
        leases
      });

      expect(screen.getByRole("region", { name: "Deployment failed" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Couldn't deploy" })).toBeInTheDocument();
      expect(screen.getByText("Not enough credits to create this lease")).toBeInTheDocument();
      expect(DeploymentRecoveryAction).toHaveBeenCalledWith({ dseq: "1234", hasLease: false, leases }, expect.anything());
    });

    it("says the lease was not created when the failure gives no reason", () => {
      setup({ launch: { phase: "failed", providers: [], hasLease: false } });

      expect(screen.getByText("Its lease wasn't created.")).toBeInTheDocument();
    });

    it("says the lease exists but the deployment never reached its provider, whatever reason the api gave", () => {
      const { DeploymentRecoveryAction } = setup({
        launch: { phase: "failed", providers: [PROVIDER], hasLease: true, reason: "Send the lease request again." }
      });

      expect(screen.getByText(/Its lease exists, but the deployment wasn't sent to its provider/)).toBeInTheDocument();
      expect(screen.queryByText("Send the lease request again.")).not.toBeInTheDocument();
      expect(DeploymentRecoveryAction).toHaveBeenCalledWith(expect.objectContaining({ hasLease: true }), expect.anything());
    });
  });

  function setup(input: { launch: DeploymentLaunch; leases?: LeaseDto[]; providers?: ApiProviderList[] }) {
    const useProvidersByAddresses = vi.fn<typeof DEPENDENCIES.useProvidersByAddresses>(() => ({
      data: input.providers ?? [],
      isLoading: false,
      isFetching: false
    }));
    const DeploymentRecoveryAction = vi.fn(() => <div>recovery</div>);

    render(
      <DeploymentLaunchState
        dseq="1234"
        launch={input.launch}
        leases={input.leases ?? []}
        dependencies={MockComponents(DEPENDENCIES, { useProvidersByAddresses, DeploymentRecoveryAction })}
      />
    );

    return { useProvidersByAddresses, DeploymentRecoveryAction };
  }
});
