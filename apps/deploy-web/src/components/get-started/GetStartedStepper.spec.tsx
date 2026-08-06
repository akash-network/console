import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, GetStartedStepper } from "./GetStartedStepper";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(GetStartedStepper.name, () => {
  it("displays USD balance", () => {
    setup({
      hasWallet: true,
      balanceUAKT: 10_000_000,
      balanceUUSDC: 5_000_000
    });

    expect(screen.queryByText(/\$/)).toBeInTheDocument();
    expect(screen.queryByText(/AKT and/)).not.toBeInTheDocument();
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

  function setup(input?: { hasWallet?: boolean; isTrialing?: boolean; balanceUAKT?: number; balanceUUSDC?: number; balanceUACT?: number }) {
    const deps = MockComponents(DEPENDENCIES, {
      useWallet: vi.fn(() => ({
        hasWallet: input?.hasWallet ?? false,
        isTrialing: input?.isTrialing ?? false,
        address: "akash1test"
      })) as unknown as (typeof DEPENDENCIES)["useWallet"],
      useWalletBalance: vi.fn(() => ({
        balance:
          input?.balanceUAKT !== undefined || input?.balanceUUSDC !== undefined || input?.balanceUACT !== undefined
            ? {
                balanceUAKT: input?.balanceUAKT ?? 0,
                balanceUUSDC: input?.balanceUUSDC ?? 0,
                balanceUACT: input?.balanceUACT ?? 0
              }
            : undefined,
        refetch: vi.fn()
      })) as unknown as (typeof DEPENDENCIES)["useWalletBalance"],
      useChainParam: vi.fn(() => ({
        minDeposit: { akt: 5, act: 5 }
      })) as unknown as (typeof DEPENDENCIES)["useChainParam"]
    });

    return render(<GetStartedStepper dependencies={deps} />);
  }
});
