import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./WalletStatus";
import { WalletStatus } from "./WalletStatus";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildWallet } from "@tests/seeders/wallet";
import { ComponentMock } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(WalletStatus.name, () => {
  it("renders skeletons while the balance is loading", () => {
    const { container } = setup({ balance: null, isBalanceLoading: true });

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Connected wallet name and balance")).not.toBeInTheDocument();
  });

  it("renders nothing when the user has no wallet", () => {
    setup({ hasWallet: false });

    expect(screen.queryByLabelText("Connected wallet name and balance")).not.toBeInTheDocument();
  });

  it("renders the managed deployment-grants balance", () => {
    setup({
      isTrialing: true,
      balance: { totalUsd: 0, totalDeploymentGrantsUSD: 12.34 }
    });

    const container = screen.getByLabelText("Connected wallet name and balance");
    expect(container.parentElement).toHaveTextContent("$12.34");
  });

  it("renders a Trial label when the wallet is trialing", () => {
    setup({ isTrialing: true });

    expect(screen.getByText("Trial")).toBeInTheDocument();
  });

  it("opens the dropdown with ManagedWalletPopup on click", async () => {
    const ManagedWalletPopup = vi.fn(ComponentMock);
    setup({ dependencies: { ManagedWalletPopup } });

    await userEvent.click(screen.getByLabelText("Connected wallet name and balance"));

    expect(ManagedWalletPopup).toHaveBeenCalled();
  });

  function setup(input: {
    hasWallet?: boolean;
    isTrialing?: boolean;
    balance?: { totalUsd: number; totalDeploymentGrantsUSD: number } | null;
    isBalanceLoading?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const wallet = buildWallet({
      hasWallet: input.hasWallet ?? true,
      isTrialing: input.isTrialing ?? false
    });

    const dependencies: typeof DEPENDENCIES = {
      useWallet: () => wallet,
      useWalletBalance: () =>
        ({
          balance: input.balance === undefined ? { totalUsd: 0, totalDeploymentGrantsUSD: 0 } : input.balance,
          isLoading: input.isBalanceLoading ?? false,
          refetch: vi.fn()
        }) as unknown as ReturnType<typeof DEPENDENCIES.useWalletBalance>,
      ManagedWalletPopup: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.ManagedWalletPopup,
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
