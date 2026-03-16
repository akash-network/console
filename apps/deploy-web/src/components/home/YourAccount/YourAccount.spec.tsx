import { describe, expect, it, vi } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, YourAccount } from "./YourAccount";

import { render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(YourAccount.name, () => {
  it("renders ConnectWallet when wallet has no address", () => {
    const ConnectWalletMock = vi.fn(ComponentMock);
    setup({
      dependencies: {
        ConnectWallet: ConnectWalletMock
      },
      wallet: { address: "" }
    });

    expect(ConnectWalletMock).toHaveBeenCalledWith(expect.objectContaining({ text: "Setup your billing to deploy!" }), expect.anything());
  });

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
        isManagedWallet: false,
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
        activeDeploymentsCount: 0,
        isManagedWallet: false
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

  it("computes costs from active leases with AKT denom", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      activeDeployments: [createDeployment()],
      leases: [createLease({ state: "active", denom: UAKT_DENOM, amount: "1000" })],
      pricing: { price: 3.5, isLoaded: true },
      dependencies: {
        AccountStatsCards: AccountStatsCardsMock
      }
    });

    expect(AccountStatsCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        costPerMonth: expect.any(Number),
        costPerHour: expect.any(Number)
      }),
      expect.anything()
    );
    const props = AccountStatsCardsMock.mock.calls[0][0];
    expect(props.costPerMonth).toBeGreaterThan(0);
    expect(props.costPerHour).toBeGreaterThan(0);
  });

  it("computes costs from active leases with USDC denom", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      activeDeployments: [createDeployment()],
      leases: [createLease({ state: "active", denom: "ibc/usdc-denom", amount: "5000" })],
      usdcDenom: "ibc/usdc-denom",
      pricing: { price: 3.5, isLoaded: true },
      dependencies: {
        AccountStatsCards: AccountStatsCardsMock
      }
    });

    const props = AccountStatsCardsMock.mock.calls[0][0];
    expect(props.costPerMonth).toBeGreaterThan(0);
  });

  it("computes costs from active leases with ACT denom", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      activeDeployments: [createDeployment()],
      leases: [createLease({ state: "active", denom: UACT_DENOM, amount: "2000" })],
      pricing: { price: 3.5, isLoaded: true },
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
      pricing: { price: 3.5, isLoaded: true },
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

  it("returns null costs when price is not loaded", () => {
    const AccountStatsCardsMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc" },
      walletBalance: createWalletBalance(),
      leases: [createLease({ state: "active" })],
      pricing: { price: undefined, isLoaded: false },
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

  it("passes isManagedWallet from wallet context to AccountHeader", () => {
    const AccountHeaderMock = vi.fn(ComponentMock);
    setup({
      wallet: { address: "akash1abc", isManaged: true },
      dependencies: {
        AccountHeader: AccountHeaderMock
      }
    });

    expect(AccountHeaderMock).toHaveBeenCalledWith(expect.objectContaining({ isManagedWallet: true }), expect.anything());
  });

  function setup(
    input: {
      isLoadingBalances?: boolean;
      walletBalance?: WalletBalance | null;
      activeDeployments?: Array<DeploymentDto>;
      leases?: Array<LeaseDto> | null;
      providers?: Array<ApiProviderList>;
      wallet?: { address?: string; isManaged?: boolean };
      pricing?: { price?: number; isLoaded?: boolean };
      usdcDenom?: string;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const useSettings: typeof DEPENDENCIES.useSettings = () =>
      ({
        settings: { isBlockchainDown: false },
        setSettings: vi.fn(),
        isLoadingSettings: false,
        isSettingsInit: true,
        refreshNodeStatuses: vi.fn(),
        isRefreshingNodeStatus: false
      }) as unknown as ReturnType<typeof DEPENDENCIES.useSettings>;

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      ({
        address: input.wallet?.address ?? "",
        walletName: "",
        isWalletConnected: !!input.wallet?.address,
        isWalletLoaded: true,
        connectManagedWallet: vi.fn(),
        logout: vi.fn(),
        signAndBroadcastTx: vi.fn(),
        isManaged: input.wallet?.isManaged ?? false,
        isCustodial: false,
        isWalletLoading: false,
        isTrialing: false,
        isOnboarding: false,
        switchWalletType: vi.fn(),
        hasManagedWallet: false
      }) as ReturnType<typeof DEPENDENCIES.useWallet>;

    const useUsdcDenom: typeof DEPENDENCIES.useUsdcDenom = () => input.usdcDenom ?? "ibc/usdc-test-denom";

    const usePricing: typeof DEPENDENCIES.usePricing = () =>
      ({
        isLoaded: input.pricing?.isLoaded ?? true,
        isLoading: false,
        price: input.pricing?.price ?? 3.5,
        uaktToUSD: vi.fn(),
        aktToUSD: vi.fn(),
        usdToAkt: vi.fn(),
        getPriceForDenom: vi.fn(),
        udenomToUsd: vi.fn()
      }) as ReturnType<typeof DEPENDENCIES.usePricing>;

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
            useUsdcDenom,
            usePricing,
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
