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

  it("does not render YourAccount when no wallet is connected", () => {
    const { YourAccount } = setup({ address: "" });

    expect(YourAccount).not.toHaveBeenCalled();
  });

  function setup(
    input: {
      address?: string;
      isSettingsInit?: boolean;
      leases?: LeaseDto[] | null;
      providers?: ApiProviderList[];
      deployments?: DeploymentDto[];
    } = {}
  ) {
    const deployments = input.deployments ?? [];
    const leases = input.leases ?? [];
    const providers = input.providers ?? [];
    const refetchDeployments = vi.fn();
    const refetchLeases = vi.fn();
    const getDeploymentName = () => null;

    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: input.address ?? "" });
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({ getDeploymentName });
    const useSettings: typeof DEPENDENCIES.useSettings = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSettings>>({
        isSettingsInit: input.isSettingsInit ?? true,
        settings: mock<ReturnType<typeof DEPENDENCIES.useSettings>["settings"]>({ apiEndpoint: "http://localhost" })
      });
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({ balance: null, isLoading: false });
    const useProviderList = vi.fn<typeof DEPENDENCIES.useProviderList>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderList>>(), { data: providers, isFetching: false })
    );
    const useDeploymentList = vi.fn<typeof DEPENDENCIES.useDeploymentList>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentList>>(), { data: deployments, isFetching: false, refetch: refetchDeployments })
    );
    const useAllLeases = vi.fn<typeof DEPENDENCIES.useAllLeases>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAllLeases>>(), { data: leases, isFetching: false, refetch: refetchLeases })
    );
    const YourAccount = vi.fn(() => <div>your account</div>);

    render(
      <HomeContainer
        dependencies={MockComponents(DEPENDENCIES, {
          useWallet,
          useLocalNotes,
          useSettings,
          useWalletBalance,
          useProviderList,
          useDeploymentList,
          useAllLeases,
          YourAccount
        })}
      />
    );

    return { useAllLeases, useDeploymentList, useProviderList, YourAccount };
  }
});
