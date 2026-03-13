import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { AccountStatsCards, DEPENDENCIES } from "./AccountStatsCards";

import { render, screen } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders/walletBalance";
import { MockComponents } from "@tests/unit/mocks";

describe(AccountStatsCards.name, () => {
  describe("when managed wallet", () => {
    it("renders total USD balance", () => {
      setup({ isManagedWallet: true, walletBalance: buildWalletBalance({ totalUsd: 150.5 }) });

      expect(screen.getByText("Available Balance")).toBeInTheDocument();
      expect(screen.getByText("$150.50")).toBeInTheDocument();
    });

    it("renders deployment escrow USD", () => {
      setup({ isManagedWallet: true, walletBalance: buildWalletBalance({ totalDeploymentEscrowUSD: 42.0 }) });

      expect(screen.getByText(/used in deployments/)).toBeInTheDocument();
    });

    it("does not render AKT or USDC or ACT cards", () => {
      setup({ isManagedWallet: true });

      expect(screen.queryByText(/AKT/)).not.toBeInTheDocument();
      expect(screen.queryByText(/USDC/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ACT/)).not.toBeInTheDocument();
    });
  });

  describe("when custodial wallet", () => {
    it("renders AKT balance card", () => {
      setup({
        isManagedWallet: false,
        walletBalance: buildWalletBalance({ balanceUAKT: 5_000_000, totalDeploymentEscrowUAKT: 1_000_000 })
      });

      expect(screen.getByText("Available Balance (AKT)")).toBeInTheDocument();
    });

    it("renders USDC balance card when ACT is not supported", () => {
      setup({
        isManagedWallet: false,
        isACTSupported: false,
        walletBalance: buildWalletBalance({ balanceUUSDC: 10_000_000 })
      });

      expect(screen.getByText("Available Balance (USDC)")).toBeInTheDocument();
      expect(screen.queryByText("Available Balance (ACT)")).not.toBeInTheDocument();
    });

    it("renders ACT balance card when ACT is supported", () => {
      setup({
        isManagedWallet: false,
        isACTSupported: true,
        walletBalance: buildWalletBalance({ balanceUACT: 10_000_000 })
      });

      expect(screen.getByText("Available Balance (ACT)")).toBeInTheDocument();
      expect(screen.queryByText("Available Balance (USDC)")).not.toBeInTheDocument();
    });
  });

  it("renders active deployments count", () => {
    setup({ activeDeploymentsCount: 7 });

    expect(screen.getByText("Active Deployments")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders total cost per hour and per month", () => {
    setup({ costPerHour: 0.05, costPerMonth: 36 });

    expect(screen.getByText("Total Cost")).toBeInTheDocument();
  });

  it("renders zero values when wallet balance is null", () => {
    setup({ walletBalance: null, isManagedWallet: false });

    expect(screen.getByText("Available Balance (AKT)")).toBeInTheDocument();
  });

  function setup(input?: {
    walletBalance?: WalletBalance | null;
    activeDeploymentsCount?: number;
    costPerMonth?: number | null;
    costPerHour?: number | null;
    isManagedWallet?: boolean;
    isACTSupported?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const usePricing: typeof DEPENDENCIES.usePricing = () => ({ price: 3.5, isLoaded: true, aktToUSD: vi.fn(), udenomToUsd: vi.fn() });
    const useSupportsACT: typeof DEPENDENCIES.useSupportsACT = () => input?.isACTSupported ?? false;

    render(
      <IntlProvider locale="en">
        <AccountStatsCards
          walletBalance={input?.walletBalance ?? buildWalletBalance()}
          activeDeploymentsCount={input?.activeDeploymentsCount ?? 0}
          costPerMonth={input?.costPerMonth ?? null}
          costPerHour={input?.costPerHour ?? null}
          isManagedWallet={input?.isManagedWallet ?? false}
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            ...DEPENDENCIES,
            usePricing,
            useSupportsACT,
            ...input?.dependencies
          }}
        />
      </IntlProvider>
    );
  }
});
