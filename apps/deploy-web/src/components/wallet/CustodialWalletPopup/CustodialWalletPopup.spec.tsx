import React from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import walletStore from "@src/store/walletStore";
import { CustodialWalletPopup, DEPENDENCIES } from "./CustodialWalletPopup";

import { fireEvent, render, screen } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders/walletBalance";

describe(CustodialWalletPopup.name, () => {
  it("renders wallet address", () => {
    setup({ address: "akash1abc123" });

    expect(screen.getByLabelText("wallet address")).toHaveTextContent("akash1abc123");
  });

  it("renders AKT balance when wallet balance is provided", () => {
    setup({ walletBalance: buildWalletBalance({ totalUAKT: 5000000 }) });

    expect(screen.getByText("AKT")).toBeInTheDocument();
    expect(screen.getByText("(5 AKT)")).toBeInTheDocument();
  });

  it("renders USDC label when ACT is not supported", () => {
    setup({
      walletBalance: buildWalletBalance({ totalUUSDC: 10000000 }),
      isACTSupported: false
    });

    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("renders ACT label when ACT is supported", () => {
    setup({
      walletBalance: buildWalletBalance({ totalUACT: 10000000 }),
      isACTSupported: true
    });

    expect(screen.getByText("ACT")).toBeInTheDocument();
  });

  it("renders unknown balance message when wallet balance is not provided", () => {
    setup();

    expect(screen.getByText(/Wallet Balance is unknown/)).toBeInTheDocument();
  });

  it("navigates to authorizations page when Authorize Spending is clicked", () => {
    const { push } = setup();

    fireEvent.click(screen.getByRole("button", { name: /Authorize Spending/ }));

    expect(push).toHaveBeenCalledWith("/settings/authorizations");
  });

  it("navigates to mint-burn page when Mint ACT is clicked", () => {
    const { push } = setup({ isACTSupported: true });

    fireEvent.click(screen.getByRole("button", { name: /Mint ACT/ }));

    expect(push).toHaveBeenCalledWith("/mint-burn");
  });

  it("calls logout when Disconnect Wallet is clicked", () => {
    const { logout } = setup();

    fireEvent.click(screen.getByRole("button", { name: /Disconnect Wallet/ }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("renders sign in link when signed in with trial and no user", () => {
    setup({ isSignedInWithTrial: true, user: null });

    expect(screen.getByText("Sign in for USD Payments")).toBeInTheDocument();
  });

  it("renders ConnectManagedWalletButton when not signed in with trial", () => {
    setup({ isSignedInWithTrial: false });

    expect(screen.getByTestId("connect-managed-wallet")).toBeInTheDocument();
  });

  it("renders ConnectManagedWalletButton when signed in with trial but user exists", () => {
    setup({ isSignedInWithTrial: true, user: { id: "user-1" } });

    expect(screen.getByTestId("connect-managed-wallet")).toBeInTheDocument();
  });

  function setup(input?: {
    address?: string;
    walletBalance?: WalletBalance | null;
    isACTSupported?: boolean;
    isSignedInWithTrial?: boolean;
    user?: Record<string, unknown> | null;
  }) {
    const logout = vi.fn();
    const push = vi.fn();
    const store = createStore();

    store.set(walletStore.isSignedInWithTrial, input?.isSignedInWithTrial ?? false);

    const dependencies = {
      ...DEPENDENCIES,
      useWallet: () => ({ address: input?.address ?? "akash1default", logout }),
      useRouter: () => ({ push }),
      useCustomUser: () => ({ user: input?.user !== undefined ? input.user : { id: "user-1" } }),
      useSupportsACT: () => input?.isACTSupported ?? false,
      Address: (props: React.HTMLAttributes<HTMLSpanElement> & { address: string }) => <span aria-label={props["aria-label"]}>{props.address}</span>,
      FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>,
      Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
        (
          <a href={href} className={className}>
            {children}
          </a>
        ) as unknown as typeof DEPENDENCIES.Link,
      ConnectManagedWalletButton: ({ className }: { className?: string }) => (
        <button data-testid="connect-managed-wallet" className={className}>
          Connect Managed Wallet
        </button>
      ),
      PriceValue: ({ value }: { value: number }) => <span>${value}</span>
    } as unknown as typeof DEPENDENCIES;

    render(
      <Provider store={store}>
        <CustodialWalletPopup walletBalance={input?.walletBalance ?? null} dependencies={dependencies} />
      </Provider>
    );

    return { logout, push };
  }
});
