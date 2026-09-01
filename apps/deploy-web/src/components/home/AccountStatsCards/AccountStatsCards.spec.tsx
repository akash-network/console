import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { AccountStatsCards, DEPENDENCIES } from "./AccountStatsCards";

import { render, screen } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders/walletBalance";
import { MockComponents } from "@tests/unit/mocks";

describe(AccountStatsCards.name, () => {
  it("renders the total account balance", () => {
    setup({ walletBalance: buildWalletBalance({ totalUsd: 150.5 }) });

    expect(screen.getByText("Account balance")).toBeInTheDocument();
    expect(screen.getByText("$150.50")).toBeInTheDocument();
  });

  it("renders what the running deployments hold in escrow", () => {
    setup({ walletBalance: buildWalletBalance({ totalDeploymentEscrowUSD: 42.0 }) });

    expect(screen.getByText("$42.00 in escrow")).toBeInTheDocument();
  });

  it("does not render AKT or USDC or ACT cards", () => {
    setup();

    expect(screen.queryByText(/AKT/)).not.toBeInTheDocument();
    expect(screen.queryByText(/USDC/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ACT/)).not.toBeInTheDocument();
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

  it("renders zero balance when wallet balance is null", () => {
    setup({ walletBalance: null });

    expect(screen.getByText("Account balance")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00")).not.toHaveLength(0);
  });

  function setup(input?: {
    walletBalance?: WalletBalance | null;
    activeDeploymentsCount?: number;
    costPerMonth?: number | null;
    costPerHour?: number | null;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    render(
      <IntlProvider locale="en">
        <AccountStatsCards
          walletBalance={input?.walletBalance === undefined ? buildWalletBalance() : input.walletBalance}
          activeDeploymentsCount={input?.activeDeploymentsCount ?? 0}
          costPerMonth={input?.costPerMonth ?? null}
          costPerHour={input?.costPerHour ?? null}
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            ...DEPENDENCIES,
            ...input?.dependencies
          }}
        />
      </IntlProvider>
    );
  }
});
