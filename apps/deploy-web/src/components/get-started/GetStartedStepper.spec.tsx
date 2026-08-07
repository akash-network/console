import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, GetStartedStepper } from "./GetStartedStepper";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(GetStartedStepper.name, () => {
  it("displays USD balance", () => {
    setup({
      hasWallet: true,
      balanceUUSDC: 5_000_000
    });

    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.queryByText(/AKT and/)).not.toBeInTheDocument();
  });

  it("combines USDC and ACT credits into the displayed balance", () => {
    setup({ hasWallet: true, balanceUUSDC: 5_000_000, balanceUACT: 2_000_000 });

    expect(screen.getByText("$7")).toBeInTheDocument();
  });

  it("displays a zero balance when the wallet holds no credit", () => {
    setup({ hasWallet: true, balanceUUSDC: 0 });

    expect(screen.getByText("$0")).toBeInTheDocument();
  });

  it("shows billing set up when wallet is connected and not trialing", () => {
    setup({ hasWallet: true });

    expect(screen.queryByText("Billing is set up")).toBeInTheDocument();
  });

  it("shows trialing indicator when wallet is connected and trialing", () => {
    setup({ hasWallet: true, isTrialing: true });

    expect(screen.queryByText("Trialing")).toBeInTheDocument();
    expect(screen.queryByText("Billing is set up")).not.toBeInTheDocument();
  });

  it("shows billing not set up when wallet is disconnected", () => {
    setup({ hasWallet: false });

    expect(screen.queryByText("Billing is not set up")).toBeInTheDocument();
  });

  function setup(input?: { hasWallet?: boolean; isTrialing?: boolean; balanceUUSDC?: number; balanceUACT?: number }) {
    const hasBalance = input?.balanceUUSDC !== undefined || input?.balanceUACT !== undefined;
    const deps = MockComponents(DEPENDENCIES, {
      useWallet: vi.fn(() =>
        mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
          hasWallet: input?.hasWallet ?? false,
          isTrialing: input?.isTrialing ?? false
        })
      ),
      useWalletBalance: vi.fn(() =>
        mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({
          balance: hasBalance
            ? {
                balanceUUSDC: input?.balanceUUSDC ?? 0,
                balanceUACT: input?.balanceUACT ?? 0
              }
            : null
        })
      )
    });

    return render(
      <TooltipProvider>
        <GetStartedStepper dependencies={deps} />
      </TooltipProvider>
    );
  }
});
