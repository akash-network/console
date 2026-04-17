import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { DEPENDENCIES, ManagedWalletPopup } from "./ManagedWalletPopup";

import { fireEvent, render, screen } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders/walletBalance";

describe(ManagedWalletPopup.name, () => {
  it("renders credits remaining and deposits when wallet balance is provided", () => {
    setup({
      walletBalance: buildWalletBalance({
        totalDeploymentGrantsUSD: 42.5,
        totalDeploymentEscrowUSD: 15.75
      })
    });

    expect(screen.getByText("Credits Remaining:")).toBeInTheDocument();
    expect(screen.getByText("42.5")).toBeInTheDocument();
    expect(screen.getByText("Deposits:")).toBeInTheDocument();
    expect(screen.getByText("15.75")).toBeInTheDocument();
  });

  it("renders unknown balance message when wallet balance is not provided", () => {
    setup();

    expect(screen.getByText(/Wallet Balance is unknown/)).toBeInTheDocument();
  });

  it("renders Free Trial header when managed and trialing", () => {
    setup({ isManaged: true, isTrialing: true });

    expect(screen.getByText("Free Trial")).toBeInTheDocument();
    expect(screen.getByText(/Once your Free credits run out/)).toBeInTheDocument();
  });

  it("does not render Free Trial header when not trialing", () => {
    setup({ isManaged: true, isTrialing: false });

    expect(screen.queryByText("Free Trial")).not.toBeInTheDocument();
    expect(screen.queryByText(/Once your Free credits run out/)).not.toBeInTheDocument();
  });

  it("renders What's this link and opens FAQ modal on click", () => {
    const { showManagedEscrowFaqModal } = setup();

    fireEvent.click(screen.getByText("What's this?"));

    expect(showManagedEscrowFaqModal).toHaveBeenCalledTimes(1);
  });

  it("renders Add Funds link pointing to payment page", () => {
    setup();

    expect(screen.getByText("Add Funds")).toBeInTheDocument();
    expect(screen.getByTestId("add-funds-link")).toHaveAttribute("href", "/billing?openPayment=true");
  });

  it("calls switchWalletType when Switch to Wallet Payments is clicked and wallet is connected", () => {
    const { switchWalletType } = setup({ isWalletConnected: true });

    fireEvent.click(screen.getByRole("button", { name: /Switch to Wallet Payments/ }));

    expect(switchWalletType).toHaveBeenCalledTimes(1);
  });

  it("calls switchWalletType when Switch to Wallet Payments is clicked and wallet is not connected", () => {
    const { switchWalletType } = setup({ isWalletConnected: false });

    fireEvent.click(screen.getByRole("button", { name: /Switch to Wallet Payments/ }));

    expect(switchWalletType).toHaveBeenCalledTimes(1);
  });

  function setup(input?: { walletBalance?: WalletBalance | null; isManaged?: boolean; isTrialing?: boolean; isWalletConnected?: boolean }) {
    const switchWalletType = vi.fn();
    const showManagedEscrowFaqModal = vi.fn();

    const dependencies = {
      ...DEPENDENCIES,
      useWallet: () => ({
        isManaged: input?.isManaged ?? false,
        isTrialing: input?.isTrialing ?? false,
        switchWalletType
      }),
      useManagedEscrowFaqModal: () => ({ showManagedEscrowFaqModal }),
      useServices: () => ({
        urlService: {
          billing: ({ openPayment }: { openPayment?: boolean } = {}) => (openPayment ? "/billing?openPayment=true" : "/billing")
        }
      }),
      FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>,
      LinkTo: ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
        <a className={className} onClick={onClick}>
          {children}
        </a>
      ),
      AddFundsLink: ({ children, className, href }: { children: React.ReactNode; className?: string; href: string }) => (
        <a data-testid="add-funds-link" href={href} className={className}>
          {children}
        </a>
      )
    } as unknown as typeof DEPENDENCIES;

    render(<ManagedWalletPopup walletBalance={input?.walletBalance ?? null} dependencies={dependencies} />);

    return { switchWalletType, showManagedEscrowFaqModal };
  }
});
