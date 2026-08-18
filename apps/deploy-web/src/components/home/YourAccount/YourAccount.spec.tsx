import { describe, expect, it, vi } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, YourAccount } from "./YourAccount";

import { render, screen } from "@testing-library/react";
import { buildWallet } from "@tests/seeders/wallet";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(YourAccount.name, () => {
  it("renders AccountHeader when wallet is connected", () => {
    const AccountHeaderMock = vi.fn(ComponentMock);
    setup({
      dependencies: {
        AccountHeader: AccountHeaderMock
      },
      wallet: { address: "akash1abc" }
    });

    expect(AccountHeaderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isBlockchainDown: false
      }),
      expect.anything()
    );
  });

  it("renders Spinner when loading balances and no wallet balance", () => {
    const SpinnerMock = vi.fn(() => <span>Loading...</span>);
    setup({
      isLoadingBalances: true,
      walletBalance: null,
      wallet: { address: "akash1abc" },
      dependencies: {
        Spinner: SpinnerMock
      }
    });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders AccountStatsCards when balances are loaded", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    const walletBalance = createWalletBalance();
    setup({
      isLoadingBalances: false,
      walletBalance,
      wallet: { address: "akash1abc" },
      dependencies: {
        AccountStatsCards: AccountStatsCardsMock
      }
    });

    expect(AccountStatsCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        walletBalance,
        activeDeploymentsCount: 0
      }),
      expect.anything()
    );
  });

  it("renders NoDeploymentsState when there are no active deployments", () => {
    const NoDeploymentsStateMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      dependencies: {
        NoDeploymentsState: NoDeploymentsStateMock
      }
    });

    expect(NoDeploymentsStateMock).toHaveBeenCalled();
  });

  it("renders ResourceStatsGrid when there are active deployments", () => {
    const ResourceStatsGridMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      activeDeployments: [createDeployment({ cpuAmount: 1000, gpuAmount: 1, memoryAmount: 1073741824, storageAmount: 5368709120 })],
      leases: [createLease({ state: "active", provider: "provider1" })],
      providers: [{ owner: "provider1", name: "Provider One" } as ApiProviderList],
      dependencies: {
        ResourceStatsGrid: ResourceStatsGridMock
      }
    });

    expect(ResourceStatsGridMock).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCpu: 1000,
        totalGpu: 1,
        providers: [{ owner: "provider1", name: "Provider One" }]
      }),
      expect.anything()
    );
  });

  it("ignores AKT-denominated leases since AKT deployments no longer exist", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      activeDeployments: [createDeployment()],
      leases: [createLease({ state: "active", denom: UAKT_DENOM, amount: "1000" })],
      dependencies: {
        AccountStatsCards: AccountStatsCardsMock
      }
    });

    const props = AccountStatsCardsMock.mock.calls[0][0];
    expect(props.costPerMonth).toBe(0);
    expect(props.costPerHour).toBe(0);
  });

  it("ignores USDC-denominated leases since deployments are funded in ACT", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      activeDeployments: [createDeployment()],
      leases: [createLease({ state: "active", denom: "ibc/usdc-denom", amount: "5000" })],
      dependencies: {
        AccountStatsCards: AccountStatsCardsMock
      }
    });

    const props = AccountStatsCardsMock.mock.calls[0][0];
    expect(props.costPerMonth).toBe(0);
  });

  it("computes costs from active leases with ACT denom", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      activeDeployments: [createDeployment()],
      leases: [createLease({ state: "active", denom: UACT_DENOM, amount: "2000" })],
      dependencies: {
        AccountStatsCards: AccountStatsCardsMock
      }
    });

    const props = AccountStatsCardsMock.mock.calls[0][0];
    expect(props.costPerMonth).toBeGreaterThan(0);
  });

  it("returns null costs when leases are not available", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      leases: null,
      dependencies: {
        AccountStatsCards: AccountStatsCardsMock
      }
    });

    expect(AccountStatsCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        costPerMonth: undefined,
        costPerHour: undefined
      }),
      expect.anything()
    );
  });

  it("deduplicates providers from active leases", () => {
    const ResourceStatsGridMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      activeDeployments: [createDeployment(), createDeployment()],
      leases: [
        createLease({ state: "active", provider: "provider1" }),
        createLease({ state: "active", provider: "provider1" }),
        createLease({ state: "active", provider: "provider2" })
      ],
      providers: [{ owner: "provider1", name: "Provider One" } as ApiProviderList, { owner: "provider2", name: "Provider Two" } as ApiProviderList],
      dependencies: {
        ResourceStatsGrid: ResourceStatsGridMock
      }
    });

    expect(ResourceStatsGridMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: [
          { owner: "provider1", name: "Provider One" },
          { owner: "provider2", name: "Provider Two" }
        ]
      }),
      expect.anything()
    );
  });

  it("shows Unknown for providers not found in providers list", () => {
    const ResourceStatsGridMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      activeDeployments: [createDeployment()],
      leases: [createLease({ state: "active", provider: "unknown-provider" })],
      providers: [],
      dependencies: {
        ResourceStatsGrid: ResourceStatsGridMock
      }
    });

    expect(ResourceStatsGridMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: [{ owner: "", name: "Unknown" }]
      }),
      expect.anything()
    );
  });

  function setup(
    input: {
      isLoadingBalances?: boolean;
      walletBalance?: WalletBalance | null;
      activeDeployments?: Array<DeploymentDto>;
      leases?: Array<LeaseDto> | null;
      providers?: Array<ApiProviderList>;
      wallet?: { address?: string };
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const useSettings: typeof DEPENDENCIES.useSettings = () =>
      ({
        settings: { isBlockchainDown: false },
        setSettings: vi.fn(),
        isLoadingSettings: false,
        isSettingsInit: true
      }) as unknown as ReturnType<typeof DEPENDENCIES.useSettings>;

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      buildWallet({
        address: input.wallet?.address ?? "",
        hasWallet: !!input.wallet?.address
      });

    render(
      <TestContainerProvider>
        <YourAccount
          isLoadingBalances={input.isLoadingBalances ?? false}
          walletBalance={input.walletBalance ?? null}
          activeDeployments={input.activeDeployments ?? []}
          leases={input.leases}
          providers={input.providers}
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useSettings,
            useWallet,
            ...input.dependencies
          }}
        />
      </TestContainerProvider>
    );
  }

  function createWalletBalance(overrides: Partial<WalletBalance> = {}): WalletBalance {
    return {
      totalUsd: 100,
      balanceUAKT: 1000000,
      balanceUUSDC: 500000,
      balanceUACT: 0,
      totalUAKT: 1000000,
      totalUUSDC: 500000,
      totalUACT: 0,
      totalDeploymentEscrowUAKT: 0,
      totalDeploymentEscrowUUSDC: 0,
      totalDeploymentEscrowUACT: 0,
      totalDeploymentEscrowUSD: 0,
      totalDeploymentGrantsUAKT: 0,
      totalDeploymentGrantsUUSDC: 0,
      totalDeploymentGrantsUACT: 0,
      totalDeploymentGrantsUSD: 0,
      ...overrides
    };
  }

  function createDeployment(overrides: Partial<DeploymentDto> = {}): DeploymentDto {
    return {
      dseq: "1",
      state: "active",
      hash: "abc",
      denom: UAKT_DENOM,
      createdAt: Date.now(),
      escrowBalance: 0,
      transferred: { denom: UAKT_DENOM, amount: "0" },
      cpuAmount: 0,
      gpuAmount: 0,
      memoryAmount: 0,
      storageAmount: 0,
      ...overrides
    } as DeploymentDto;
  }

  function createLease(overrides: { state?: string; provider?: string; denom?: string; amount?: string } = {}): LeaseDto {
    return {
      id: "1",
      owner: "owner1",
      provider: overrides.provider ?? "provider1",
      dseq: "1",
      gseq: 1,
      oseq: 1,
      state: overrides.state ?? "active",
      price: {
        denom: overrides.denom ?? UAKT_DENOM,
        amount: overrides.amount ?? "100"
      },
      cpuAmount: 0,
      memoryAmount: 0,
      storageAmount: 0
    } as LeaseDto;
  }
});
