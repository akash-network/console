import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, GetStartedStepper } from "./GetStartedStepper";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(GetStartedStepper.name, () => {
  it("displays AKT and USDC balance for custodial wallet", () => {
    setup({
      isWalletConnected: true,
      isManagedWallet: false,
      balanceUAKT: 10_000_000,
      balanceUUSDC: 5_000_000
    });

    expect(screen.queryByText("10")).toBeInTheDocument();
    expect(screen.queryByText(/AKT and/)).toBeInTheDocument();
    expect(screen.queryByText(/USDC/)).toBeInTheDocument();
  });

  it("displays USD balance for managed wallet", () => {
    setup({
      isWalletConnected: true,
      isManagedWallet: true,
      balanceUAKT: 10_000_000,
      balanceUUSDC: 5_000_000
    });

    expect(screen.queryByText(/\$/)).toBeInTheDocument();
    expect(screen.queryByText(/AKT and/)).not.toBeInTheDocument();
  });

  it("shows billing not set up when wallet is disconnected", () => {
    setup({ isWalletConnected: false });

    expect(screen.queryByText("Billing is not set up")).toBeInTheDocument();
  });

  function setup(input?: {
    isWalletConnected?: boolean;
    isManagedWallet?: boolean;
    isTrialing?: boolean;
    balanceUAKT?: number;
    balanceUUSDC?: number;
    balanceUACT?: number;
  }) {
    const deps = MockComponents(DEPENDENCIES, {
      useWallet: vi.fn(() => ({
        isWalletConnected: input?.isWalletConnected ?? false,
        isManaged: input?.isManagedWallet ?? false,
        isTrialing: input?.isTrialing ?? false,
        address: "akash1test"
      })) as unknown as (typeof DEPENDENCIES)["useWallet"],
      useWalletBalance: vi.fn(() => ({
        balance:
          input?.balanceUAKT !== undefined
            ? {
                balanceUAKT: input.balanceUAKT,
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
