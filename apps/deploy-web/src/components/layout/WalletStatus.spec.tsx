import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./WalletStatus";
import { WalletStatus } from "./WalletStatus";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildWallet } from "@tests/seeders/wallet";
import { ComponentMock } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(WalletStatus.name, () => {
  it("renders skeletons while the wallet is initializing", () => {
    const { container } = setup({ isWalletLoaded: false });

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Connected wallet name and balance")).not.toBeInTheDocument();
  });

  it("renders the WalletConnectionButtons when no wallet is connected", () => {
    const WalletConnectionButtons = vi.fn(ComponentMock);
    setup({ isWalletConnected: false, dependencies: { WalletConnectionButtons } });

    expect(WalletConnectionButtons).toHaveBeenCalled();
    expect(screen.queryByLabelText("Connected wallet name and balance")).not.toBeInTheDocument();
  });

  it("renders a custodial wallet name and balance", () => {
    setup({
      walletName: "alice-wallet",
      isManaged: false,
      balance: { totalUsd: 12.34, totalDeploymentGrantsUSD: 0 }
    });

    const container = screen.getByLabelText("Connected wallet name and balance");
    expect(container).toHaveTextContent("alice-wallet");
    expect(container.parentElement).toHaveTextContent("$12.34");
  });

  it("renders a Trial label when the wallet is managed and trialing", () => {
    setup({ isManaged: true, isTrialing: true });

    expect(screen.getByText("Trial")).toBeInTheDocument();
  });

  it("opens the dropdown with CustodialWalletPopup on click for a custodial wallet", async () => {
    const CustodialWalletPopup = vi.fn(ComponentMock);
    const ManagedWalletPopup = vi.fn(ComponentMock);
    setup({ isManaged: false, dependencies: { CustodialWalletPopup, ManagedWalletPopup } });

    await userEvent.click(screen.getByLabelText("Connected wallet name and balance"));

    expect(CustodialWalletPopup).toHaveBeenCalled();
    expect(ManagedWalletPopup).not.toHaveBeenCalled();
  });

  it("opens the dropdown with ManagedWalletPopup on click for a managed wallet", async () => {
    const CustodialWalletPopup = vi.fn(ComponentMock);
    const ManagedWalletPopup = vi.fn(ComponentMock);
    setup({ isManaged: true, dependencies: { CustodialWalletPopup, ManagedWalletPopup } });

    await userEvent.click(screen.getByLabelText("Connected wallet name and balance"));

    expect(ManagedWalletPopup).toHaveBeenCalled();
    expect(CustodialWalletPopup).not.toHaveBeenCalled();
  });

  function setup(input: {
    walletName?: string;
    isWalletLoaded?: boolean;
    isWalletConnected?: boolean;
    isManaged?: boolean;
    isTrialing?: boolean;
    isWalletLoading?: boolean;
    balance?: { totalUsd: number; totalDeploymentGrantsUSD: number };
    isBalanceLoading?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const wallet = buildWallet({
      walletName: input.walletName ?? "test-wallet",
      isWalletLoaded: input.isWalletLoaded ?? true,
      isWalletConnected: input.isWalletConnected ?? true,
      isManaged: input.isManaged ?? false,
      isTrialing: input.isTrialing ?? false,
      isWalletLoading: input.isWalletLoading ?? false
    });

    const dependencies: typeof DEPENDENCIES = {
      useWallet: () => wallet,
      useWalletBalance: () =>
        ({
          balance: input.balance ?? { totalUsd: 0, totalDeploymentGrantsUSD: 0 },
          isLoading: input.isBalanceLoading ?? false,
          refetch: vi.fn()
        }) as unknown as ReturnType<typeof DEPENDENCIES.useWalletBalance>,
      CustodialWalletPopup: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.CustodialWalletPopup,
      ManagedWalletPopup: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.ManagedWalletPopup,
      WalletConnectionButtons: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.WalletConnectionButtons,
      FormattedNumber: ({ value }: { value: number }) => <span>${value}</span>,
      ...input.dependencies
    } as unknown as typeof DEPENDENCIES;

    return render(
      <TestContainerProvider>
        <WalletStatus dependencies={dependencies} />
      </TestContainerProvider>
    );
  }
});
