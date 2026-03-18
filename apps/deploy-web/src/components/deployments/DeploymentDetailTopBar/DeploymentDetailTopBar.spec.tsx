import { describe, expect, it, type Mock, vi } from "vitest";

import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentDetailTopBar } from "./DeploymentDetailTopBar";

import { act, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentDetailTopBar.name, () => {
  it("renders default title when no deployment name is set", () => {
    setup();

    expect(screen.getByText("Deployment detail")).toBeInTheDocument();
  });

  it("renders deployment name when set", () => {
    setup({
      localNotes: {
        getDeploymentName: () => "My Deployment"
      }
    });

    expect(screen.getByText("My Deployment")).toBeInTheDocument();
  });

  it("renders back and refresh button with aria-label", () => {
    const deps = setup();

    expect(deps.Button).toHaveBeenCalledWith(expect.objectContaining({ "aria-label": "back" }), {});
    expect(deps.Button).toHaveBeenCalledWith(expect.objectContaining({ "aria-label": "refresh" }), {});
  });

  it("calls loadDeploymentDetail when refresh button is clicked", () => {
    const loadDeploymentDetail = vi.fn();
    const deps = setup({ loadDeploymentDetail });

    act(() => {
      clickMockComponent(deps.Button, ([props]) => props["aria-label"] === "refresh");
    });

    expect(loadDeploymentDetail).toHaveBeenCalled();
  });

  it("navigates back when back button is clicked and previous route exists", () => {
    const back = vi.fn();
    const deps = setup({
      previousRoute: "/deployments",
      router: { back }
    });

    act(() => {
      clickMockComponent(deps.Button, ([props]) => props["aria-label"] === "back");
    });

    expect(back).toHaveBeenCalled();
  });

  it("navigates to deployment list when back button is clicked and no previous route", () => {
    const push = vi.fn();
    const deps = setup({
      previousRoute: null,
      router: { push }
    });

    act(() => {
      clickMockComponent(deps.Button, ([props]) => props["aria-label"] === "back");
    });

    expect(push).toHaveBeenCalled();
  });

  describe("active deployment", () => {
    it("renders Edit Name and Close options", () => {
      const deps = setup({
        deployment: createDeployment({ state: "active" })
      });

      expect(deps.CustomDropdownLinkItem).toHaveBeenCalledWith(expect.objectContaining({ children: "Edit Name" }), {});
      expect(deps.CustomDropdownLinkItem).toHaveBeenCalledWith(expect.objectContaining({ children: "Close" }), {});
    });

    it("renders Add funds button", () => {
      const deps = setup({
        deployment: createDeployment({ state: "active" })
      });

      expect(deps.Button).toHaveBeenCalledWith(expect.objectContaining({ children: "Add funds" }), {});
    });

    it("renders Redeploy option when manifest exists", () => {
      const deps = setup({
        deployment: createDeployment({ state: "active" }),
        localNotes: {
          getDeploymentData: () => ({ manifest: "some-manifest" })
        }
      });

      expect(deps.CustomDropdownLinkItem).toHaveBeenCalledWith(expect.objectContaining({ children: "Redeploy" }), {});
    });

    it("does not render Redeploy option when manifest is missing", () => {
      setup({
        deployment: createDeployment({ state: "active" }),
        localNotes: {
          getDeploymentData: () => null
        }
      });

      expect(screen.queryByText("Redeploy")).not.toBeInTheDocument();
    });

    it("renders auto top-up section when wallet is managed", () => {
      setup({
        deployment: createDeployment({ state: "active" }),
        wallet: { isManaged: true }
      });

      expect(screen.getByText("Auto top-up")).toBeInTheDocument();
    });

    it("does not render auto top-up section when wallet is not managed", () => {
      setup({
        deployment: createDeployment({ state: "active" }),
        wallet: { isManaged: false }
      });

      expect(screen.queryByText("Auto top-up")).not.toBeInTheDocument();
    });

    it("renders DeploymentDepositModal after Add funds click", () => {
      const deps = setup({
        deployment: createDeployment({ state: "active" })
      });

      act(() => {
        clickMockComponent(deps.Button, ([props]) => props.children === "Add funds");
      });

      expect(deps.DeploymentDepositModal).toHaveBeenCalled();
    });

    it("tracks edit name event when Edit Name is clicked", () => {
      const track = vi.fn();
      const deps = setup({
        deployment: createDeployment({ state: "active" }),
        analyticsTrack: track
      });

      clickMockComponent(deps.CustomDropdownLinkItem, ([props]) => props.children === "Edit Name");

      expect(track).toHaveBeenCalledWith("edit_name_btn_clk", "Amplitude");
    });

    it("tracks close deployment event when Close is clicked", () => {
      const track = vi.fn();
      const deps = setup({
        deployment: createDeployment({ state: "active" }),
        analyticsTrack: track
      });

      clickMockComponent(deps.CustomDropdownLinkItem, ([props]) => props.children === "Close");

      expect(track).toHaveBeenCalledWith("close_deployment_btn_clk", "Amplitude");
    });
  });

  describe("closed deployment", () => {
    it("renders Edit Name button", () => {
      setup({
        deployment: createDeployment({ state: "closed" })
      });

      expect(screen.getByText(/Edit Name/)).toBeInTheDocument();
    });

    it("renders Redeploy button when manifest exists", () => {
      setup({
        deployment: createDeployment({ state: "closed" }),
        localNotes: {
          getDeploymentData: () => ({ manifest: "some-manifest" })
        }
      });

      expect(screen.getByText(/Redeploy/)).toBeInTheDocument();
    });

    it("does not render Redeploy button when manifest is missing", () => {
      setup({
        deployment: createDeployment({ state: "closed" }),
        localNotes: {
          getDeploymentData: () => null
        }
      });

      expect(screen.queryByText(/Redeploy/)).not.toBeInTheDocument();
    });

    it("does not render Add funds button", () => {
      setup({
        deployment: createDeployment({ state: "closed" })
      });

      expect(screen.queryByText("Add funds")).not.toBeInTheDocument();
    });

    it("does not render Close option", () => {
      setup({
        deployment: createDeployment({ state: "closed" })
      });

      expect(screen.queryByText("Close")).not.toBeInTheDocument();
    });
  });

  function setup(input?: {
    deployment?: DeploymentDto;
    loadDeploymentDetail?: () => void;
    removeLeases?: () => void;
    onDeploymentClose?: () => void;
    previousRoute?: string | null;
    router?: { back?: () => void; push?: () => void };
    wallet?: { isManaged?: boolean; denom?: string; signAndBroadcastTx?: () => Promise<boolean> };
    analyticsTrack?: ReturnType<typeof vi.fn>;
    localNotes?: {
      getDeploymentName?: (dseq: string | number) => string | null | undefined;
      getDeploymentData?: (dseq: string | number) => { manifest?: string } | null;
      changeDeploymentName?: (dseq: string | number) => void;
    };
  }) {
    const deployment = input?.deployment ?? createDeployment();
    const track = input?.analyticsTrack ?? vi.fn();
    const deps = MockComponents(DEPENDENCIES, {
      useServices: vi.fn(() => ({
        analyticsService: { track }
      })) as unknown as typeof DEPENDENCIES.useServices,
      useLocalNotes: vi.fn(() => ({
        getDeploymentName: input?.localNotes?.getDeploymentName ?? (() => null),
        getDeploymentData: input?.localNotes?.getDeploymentData ?? (() => null),
        changeDeploymentName: input?.localNotes?.changeDeploymentName ?? vi.fn(),
        favoriteProviders: [],
        updateFavoriteProviders: vi.fn()
      })) as typeof DEPENDENCIES.useLocalNotes,
      useWallet: vi.fn(() => ({
        signAndBroadcastTx: input?.wallet?.signAndBroadcastTx ?? vi.fn(() => Promise.resolve(true)),
        isManaged: input?.wallet?.isManaged ?? false,
        denom: input?.wallet?.denom ?? "uakt",
        address: "akash1test",
        walletName: "test",
        isWalletConnected: true,
        isWalletLoaded: true,
        connectManagedWallet: vi.fn(),
        logout: vi.fn(),
        isCustodial: false,
        isWalletLoading: false,
        isTrialing: false,
        isOnboarding: false,
        switchWalletType: vi.fn(),
        hasManagedWallet: false
      })) as typeof DEPENDENCIES.useWallet,
      usePricing: vi.fn(() => ({
        isLoaded: true,
        isLoading: false,
        price: 1,
        uaktToUSD: vi.fn(() => 0),
        aktToUSD: vi.fn(() => 0),
        usdToAkt: vi.fn(() => 0),
        getPriceForDenom: vi.fn(() => 0),
        udenomToUsd: vi.fn(() => 0)
      })) as typeof DEPENDENCIES.usePricing,
      usePreviousRoute: vi.fn(() => input?.previousRoute ?? null) as typeof DEPENDENCIES.usePreviousRoute,
      useManagedDeploymentConfirm: vi.fn(() => ({
        closeDeploymentConfirm: vi.fn(() => Promise.resolve(true))
      })) as typeof DEPENDENCIES.useManagedDeploymentConfirm,
      useUser: vi.fn(() => ({
        user: { id: "user-1" },
        isLoading: false,
        checkSession: vi.fn()
      })) as unknown as typeof DEPENDENCIES.useUser,
      useDeploymentSettingQuery: vi.fn(() => ({
        data: { autoTopUpEnabled: false, estimatedTopUpAmount: 0, topUpFrequencyMs: 0 },
        setAutoTopUpEnabled: vi.fn(),
        isLoading: false,
        isFetching: false,
        isUpdating: false,
        update: vi.fn(),
        error: null
      })) as unknown as typeof DEPENDENCIES.useDeploymentSettingQuery,
      useDeploymentMetrics: vi.fn(() => ({
        realTimeLeft: undefined,
        deploymentCost: 0
      })) as typeof DEPENDENCIES.useDeploymentMetrics,
      useCurrencyFormatter: vi.fn(() => (value: number) => `$${value.toFixed(2)}`) as unknown as typeof DEPENDENCIES.useCurrencyFormatter,
      usePopup: vi.fn(() => ({
        confirm: vi.fn(() => Promise.resolve(true)),
        prompt: vi.fn()
      })) as unknown as typeof DEPENDENCIES.usePopup,
      useRouter: vi.fn(() => ({
        back: input?.router?.back ?? vi.fn(),
        push: input?.router?.push ?? vi.fn(),
        replace: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
        forward: vi.fn()
      })) as unknown as typeof DEPENDENCIES.useRouter
    });

    render(
      <DeploymentDetailTopBar
        address="akash1test"
        loadDeploymentDetail={input?.loadDeploymentDetail ?? vi.fn()}
        removeLeases={input?.removeLeases ?? vi.fn()}
        onDeploymentClose={input?.onDeploymentClose ?? vi.fn()}
        deployment={deployment}
        leases={[]}
        dependencies={deps}
      />
    );

    return deps;
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clickMockComponent(mock: Mock, predicate: (call: any[]) => boolean) {
  const call = mock.mock.calls.find(predicate);
  call?.[0].onClick();
}

function createDeployment(overrides?: Partial<DeploymentDto>): DeploymentDto {
  return {
    dseq: "123456",
    state: "active",
    hash: "abc123",
    denom: "uakt",
    createdAt: Date.now(),
    escrowBalance: 1000000,
    transferred: { denom: "uakt", amount: "0" },
    cpuAmount: 1000,
    memoryAmount: 1073741824,
    storageAmount: 5368709120,
    escrowAccount: {
      state: {
        funds: [{ denom: "uakt", amount: "1000000" }]
      }
    },
    groups: [],
    ...overrides
  } as DeploymentDto;
}
