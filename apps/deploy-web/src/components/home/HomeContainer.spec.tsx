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

  it("looks up only the providers of the live leases", () => {
    const leases = [
      mock<LeaseDto>({ dseq: "1", state: "active", provider: "akash1running" }),
      mock<LeaseDto>({ dseq: "2", state: "reclaiming", provider: "akash1reclaiming" }),
      mock<LeaseDto>({ dseq: "3", state: "closed", provider: "akash1gone" })
    ];
    const { useProvidersByAddresses } = setup({ address: "akash1owner", leases });

    expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["akash1running", "akash1reclaiming"]);
  });

  it("hands YourAccount no providers while they are still being looked up", () => {
    const leases = [mock<LeaseDto>({ dseq: "1", state: "active", provider: "akash1running" })];
    const { YourAccount } = setup({ address: "akash1owner", leases, isLookingUpProviders: true });

    expect(YourAccount).toHaveBeenCalledWith(expect.objectContaining({ providers: undefined }), expect.anything());
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

  it("asks the console for the names of the account's active deployments", () => {
    const { useDeploymentNames } = setup({
      address: "akash1owner",
      deployments: [mock<DeploymentDto>({ dseq: "100" }), mock<DeploymentDto>({ dseq: "200" })]
    });

    expect(useDeploymentNames).toHaveBeenLastCalledWith(["100", "200"]);
  });

  it("asks for no names and leaves YourAccount empty until the account's deployments arrive", () => {
    const { useDeploymentNames, YourAccount } = setup({ address: "akash1owner", deploymentsUnresolved: true });

    expect(useDeploymentNames).toHaveBeenLastCalledWith([]);
    expect(YourAccount).toHaveBeenCalledWith(expect.objectContaining({ activeDeployments: [] }), expect.anything());
  });

  it("hands YourAccount a deployment the account gained after the first render", () => {
    const { YourAccount, rerenderWith } = setup({ address: "akash1owner", deployments: [mock<DeploymentDto>({ dseq: "100" })] });

    rerenderWith({ deployments: [mock<DeploymentDto>({ dseq: "100" }), mock<DeploymentDto>({ dseq: "200" })] });

    expect(YourAccount).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeDeployments: [expect.objectContaining({ dseq: "100" }), expect.objectContaining({ dseq: "200" })] }),
      expect.anything()
    );
  });

  function setup(
    input: {
      address?: string;
      leases?: LeaseDto[];
      providers?: ApiProviderList[];
      isLookingUpProviders?: boolean;
      deployments?: DeploymentDto[];
      deploymentsUnresolved?: boolean;
      names?: Record<string, string>;
    } = {}
  ) {
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: input.address ?? "" });
    const getDeploymentName = (dseq: string | number | null | undefined) => input.names?.[String(dseq)] ?? null;
    const useDeploymentNames = vi.fn<typeof DEPENDENCIES.useDeploymentNames>(() => ({ getDeploymentName }));
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({ balance: null, isLoading: false });
    const providerLookup = { data: input.providers ?? [], isLoading: !!input.isLookingUpProviders, isFetching: !!input.isLookingUpProviders };
    const useProvidersByAddresses = vi.fn((_addresses: readonly string[]) => providerLookup);
    const useDeploymentList = mockQueryHook<typeof DEPENDENCIES.useDeploymentList>(input.deploymentsUnresolved ? undefined : input.deployments ?? []);
    const useAllLeases = mockQueryHook<typeof DEPENDENCIES.useAllLeases>(input.leases ?? []);
    const YourAccount = vi.fn(() => <div>your account</div>);

    const dependencies = MockComponents(DEPENDENCIES, {
      useWallet,
      useDeploymentNames,
      useWalletBalance,
      useProvidersByAddresses,
      useDeploymentList,
      useAllLeases,
      YourAccount
    });
    const { rerender } = render(<HomeContainer dependencies={dependencies} />);

    return {
      useAllLeases,
      useDeploymentList,
      useDeploymentNames,
      useProvidersByAddresses,
      YourAccount,
      rerenderWith(next: { deployments: DeploymentDto[] }) {
        useDeploymentList.setData(next.deployments);
        rerender(<HomeContainer dependencies={dependencies} />);
      }
    };
  }

  /** Returns the same result object on every render so `data`/`refetch` refs stay stable for the component's effect deps. */
  function mockQueryHook<THook extends (...args: never[]) => { data: unknown }>(data: ReturnType<THook>["data"]) {
    const result = Object.assign(mock<ReturnType<THook>>(), { data, isFetching: false, refetch: vi.fn() });
    return Object.assign(
      vi.fn(() => result),
      {
        setData(next: ReturnType<THook>["data"]) {
          result.data = next;
        }
      }
    );
  }
});
