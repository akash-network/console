import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { BootLoadingProvider } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import type { CustomUserProfile } from "@src/types/user";
import { DEPENDENCIES, WalletProvider } from "./WalletProvider";

import { render, screen } from "@testing-library/react";
import { buildManagedWallet } from "@tests/seeders/managedWallet";

type ManagedWalletHookResult = ReturnType<typeof DEPENDENCIES.useManagedWallet>;

describe(WalletProvider.name, () => {
  it("blocks children behind the boot overlay while the wallet lookup is in flight for a registered user", () => {
    setup({ user: registeredUser(), managedWallet: { isInitializing: true, wallet: undefined } });

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-boot-loading")).toBeInTheDocument();
  });

  it("renders children once the wallet lookup settles with a wallet", () => {
    setup({ user: registeredUser(), managedWallet: { isInitializing: false, wallet: decoratedWallet() } });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("app-boot-loading")).not.toBeInTheDocument();
  });

  it("renders children when the lookup settles with no wallet", () => {
    setup({ user: registeredUser(), managedWallet: { isInitializing: false, wallet: undefined } });

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("does not block anonymous users while the wallet query loads", () => {
    setup({ user: anonymousUser(), managedWallet: { isInitializing: true, wallet: undefined } });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("app-boot-loading")).not.toBeInTheDocument();
  });

  it("keeps children mounted while a trial wallet is being created", () => {
    setup({ user: registeredUser(), managedWallet: { isInitializing: false, isLoading: true, wallet: undefined } });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("app-boot-loading")).not.toBeInTheDocument();
  });

  it("mounts children when the lookup transitions from loading to settled", () => {
    const { rerenderWithManagedWallet } = setup({ user: registeredUser(), managedWallet: { isInitializing: true, wallet: undefined } });

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();

    rerenderWithManagedWallet({ isInitializing: false, wallet: decoratedWallet() });

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("does not render the transaction modal while gated", () => {
    setup({ user: registeredUser(), managedWallet: { isInitializing: true, wallet: undefined } });

    expect(screen.queryByTestId("tx-modal")).not.toBeInTheDocument();
  });

  it("renders the transaction modal once settled", () => {
    setup({ user: registeredUser(), managedWallet: { isInitializing: false, wallet: decoratedWallet() } });

    expect(screen.getByTestId("tx-modal")).toBeInTheDocument();
  });

  function registeredUser() {
    return mock<CustomUserProfile>({ id: "internal-id", userId: "auth-user-id" });
  }

  function anonymousUser() {
    return mock<CustomUserProfile>({ id: "internal-id", userId: undefined });
  }

  function decoratedWallet() {
    return { ...buildManagedWallet(), isWalletLoaded: true, selected: true };
  }

  function setup(input: { user?: CustomUserProfile; managedWallet?: Partial<ManagedWalletHookResult> }) {
    let managedWallet = mock<ManagedWalletHookResult>(input.managedWallet);

    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.user }),
      useManagedWallet: () => managedWallet,
      useBalances: () => mock<ReturnType<typeof DEPENDENCIES.useBalances>>(),
      useSignAndBroadcast: () => ({ signAndBroadcastTx: vi.fn(), loadingState: undefined }),
      useServices: () =>
        mock<ReturnType<typeof DEPENDENCIES.useServices>>({
          analyticsService: mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>(),
          urlService: mock<ReturnType<typeof DEPENDENCIES.useServices>["urlService"]>(),
          publicConfig: mock<ReturnType<typeof DEPENDENCIES.useServices>["publicConfig"]>({ NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: "sandbox" })
        }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>(),
      TransactionModal: vi.fn(() => <div data-testid="tx-modal" />),
      BootLoading: DEPENDENCIES.BootLoading
    };

    const renderTree = () => (
      <BootLoadingProvider>
        <WalletProvider dependencies={dependencies}>
          <div data-testid="child" />
        </WalletProvider>
      </BootLoadingProvider>
    );

    const view = render(renderTree());

    return {
      ...view,
      rerenderWithManagedWallet: (next: Partial<ManagedWalletHookResult>) => {
        managedWallet = mock<ManagedWalletHookResult>(next);
        view.rerender(renderTree());
      }
    };
  }
});
