import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import { DEPENDENCIES, HomeContainer } from "./HomeContainer";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(HomeContainer.name, () => {
  it("requests only live leases instead of the full lease history", () => {
    const { useAllLeases } = setup({ address: "akash1owner" });

    expect(useAllLeases).toHaveBeenCalledWith("akash1owner", expect.objectContaining({ state: LIVE_LEASE_STATES }));
  });

  it("requests only active deployments for the account aggregates", () => {
    const { useDeploymentList } = setup({ address: "akash1owner" });

    expect(useDeploymentList).toHaveBeenCalledWith("akash1owner", expect.objectContaining({ enabled: false }), "active");
  });

  it("passes the fetched leases and providers to YourAccount once settings are initialised", () => {
    const leases = [mock<LeaseDto>({ dseq: "1", state: "active" })];
    const providers = [mock<ApiProviderList>({ owner: "provider1" })];
    const { YourAccount } = setup({ address: "akash1owner", leases, providers });

    expect(YourAccount).toHaveBeenCalledWith(expect.objectContaining({ leases, providers }), expect.anything());
  });

  it("hands YourAccount the active deployments under the names the console holds", () => {
    const { YourAccount } = setup({ address: "akash1owner", deployments: [mock<DeploymentDto>({ dseq: "100" })], names: { "100": "web" } });

    expect(YourAccount).toHaveBeenCalledWith(
      expect.objectContaining({ activeDeployments: [expect.objectContaining({ dseq: "100", name: "web" })] }),
      expect.anything()
    );
  });

  it("does not render YourAccount when no wallet is connected", () => {
    const { YourAccount } = setup({ address: "" });

    expect(YourAccount).not.toHaveBeenCalled();
  });

  function setup(
    input: { address?: string; leases?: LeaseDto[]; providers?: ApiProviderList[]; deployments?: DeploymentDto[]; names?: Record<string, string> } = {}
  ) {
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: input.address ?? "" });
    const getDeploymentName = (dseq: string | number | null | undefined) => input.names?.[String(dseq)] ?? null;
    const useDeploymentNames: typeof DEPENDENCIES.useDeploymentNames = () => ({ getDeploymentName });
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({ balance: null, isLoading: false });
    const useProviderList = mockQueryHook<typeof DEPENDENCIES.useProviderList>(input.providers ?? []);
    const useDeploymentList = mockQueryHook<typeof DEPENDENCIES.useDeploymentList>(input.deployments ?? []);
    const useAllLeases = mockQueryHook<typeof DEPENDENCIES.useAllLeases>(input.leases ?? []);
    const YourAccount = vi.fn(() => <div>your account</div>);

    render(
      <HomeContainer
        dependencies={MockComponents(DEPENDENCIES, {
          useWallet,
          useDeploymentNames,
          useWalletBalance,
          useProviderList,
          useDeploymentList,
          useAllLeases,
          YourAccount
        })}
      />
    );

    return { useAllLeases, useDeploymentList, YourAccount };
  }

  /** Returns the same result object on every render so `data`/`refetch` refs stay stable for the component's effect deps. */
  function mockQueryHook<THook extends (...args: never[]) => { data: unknown }>(data: ReturnType<THook>["data"]) {
    const result = Object.assign(mock<ReturnType<THook>>(), { data, isFetching: false, refetch: vi.fn() });
    return vi.fn(() => result);
  }
});
