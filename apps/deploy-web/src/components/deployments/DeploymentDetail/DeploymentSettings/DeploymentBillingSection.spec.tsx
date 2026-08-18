import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentBillingSection } from "./DeploymentBillingSection";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentBillingSection", () => {
  it("opens the deposit modal when Add funds is clicked on an active deployment", async () => {
    setup({ state: "active" });

    await userEvent.click(screen.getByRole("button", { name: "Add funds" }));

    expect(screen.getByText("deposit-modal")).toBeInTheDocument();
  });

  it("enables auto top-up when the toggle is switched on", async () => {
    const { setEnabled } = setup({ state: "active", isEnabled: false });

    await userEvent.click(screen.getByRole("switch", { name: "Auto Top-Up" }));

    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("hides Add funds and the auto top-up toggle when the deployment is closed", () => {
    setup({ state: "closed" });

    expect(screen.queryByRole("button", { name: "Add funds" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows the real-time draining escrow balance for an active deployment with live leases", () => {
    setup({ state: "active", escrowBalance: 2000000, realTimeLeftEscrow: 500000, leases: [mock<LeaseDto>({ id: "1", state: "active" })] });

    expect(screen.getByTestId("current-balance")).toHaveTextContent("0.5");
  });

  it("shows the settled escrow balance when the deployment has no live leases", () => {
    setup({ state: "active", escrowBalance: 2000000, realTimeLeftEscrow: 500000, leases: [] });

    expect(screen.getByTestId("current-balance")).toHaveTextContent("2");
  });

  function setup(input: { state?: string; isEnabled?: boolean; escrowBalance?: number; realTimeLeftEscrow?: number; leases?: LeaseDto[] | null }) {
    const setEnabled = vi.fn();
    const deposit = vi.fn();
    const onFundsChanged = vi.fn();

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ denom: "uakt" });
    const usePricing: typeof DEPENDENCIES.usePricing = () => mock<ReturnType<typeof DEPENDENCIES.usePricing>>({ udenomToUsd: () => 0 });
    const realTimeLeft: ReturnType<typeof DEPENDENCIES.useAutoTopUp>["realTimeLeft"] =
      input.realTimeLeftEscrow !== undefined ? { timeLeft: new Date(), escrow: input.realTimeLeftEscrow, amountSpent: 0 } : undefined;
    const useAutoTopUp: typeof DEPENDENCIES.useAutoTopUp = () =>
      mock<ReturnType<typeof DEPENDENCIES.useAutoTopUp>>({
        isEnabled: input.isEnabled ?? false,
        isLoading: false,
        estimatedTopUpAmount: 0,
        topUpFrequencyMs: 0,
        realTimeLeft,
        setEnabled,
        deposit
      });
    const DeploymentDepositModal = vi.fn(() => <div>deposit-modal</div>);
    const PriceValue: typeof DEPENDENCIES.PriceValue = ({ value }) => <span data-testid="current-balance">{value}</span>;

    const deployment = mock<DeploymentDto>({
      dseq: "1786440078202",
      state: input.state ?? "active",
      escrowBalance: input.escrowBalance ?? 1000000,
      escrowAccount: mock<DeploymentDto["escrowAccount"]>({
        state: mock<DeploymentDto["escrowAccount"]["state"]>({ funds: [{ denom: "uakt", amount: "1000000" }] })
      })
    });
    const leases = input.leases !== undefined ? input.leases : [mock<LeaseDto>({ id: "1", state: "active" })];

    render(
      <DeploymentBillingSection
        deployment={deployment}
        leases={leases}
        onFundsChanged={onFundsChanged}
        dependencies={MockComponents(DEPENDENCIES, { useServices, useWallet, usePricing, useAutoTopUp, DeploymentDepositModal, PriceValue })}
      />
    );

    return { setEnabled, deposit, onFundsChanged };
  }
});
