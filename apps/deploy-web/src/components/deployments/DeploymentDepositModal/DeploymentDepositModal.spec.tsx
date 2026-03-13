import { describe, expect, it, vi } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { DEPENDENCIES } from "./DeploymentDepositModal";
import { DeploymentDepositModal } from "./DeploymentDepositModal";

import { fireEvent, render, screen } from "@testing-library/react";

describe(DeploymentDepositModal.name, () => {
  it("shows ACT mint alert when denom is ACT and balance is 0", () => {
    setup({ denom: UACT_DENOM, denomBalance: 0 });

    expect(screen.getByText(/mint ACT tokens/)).toBeInTheDocument();
    expect(screen.getByText("Go to Mint / Burn")).toBeInTheDocument();
  });

  it("shows ACT mint alert when denom is ACT and balance is less than amount", () => {
    setup({ denom: UACT_DENOM, denomBalance: 5, denomMin: 10 });

    expect(screen.getByText(/mint ACT tokens/)).toBeInTheDocument();
  });

  it("does not show ACT mint alert when denom is ACT and balance is sufficient", () => {
    setup({ denom: UACT_DENOM, denomBalance: 100, denomMin: 5 });

    expect(screen.queryByText(/mint ACT tokens/)).not.toBeInTheDocument();
  });

  it("does not show ACT mint alert when denom is not ACT", () => {
    setup({ denom: UAKT_DENOM, denomBalance: 0 });

    expect(screen.queryByText(/mint ACT tokens/)).not.toBeInTheDocument();
  });

  it("navigates to mint-burn page and closes modal on CTA click", () => {
    const { handleCancel, routerPush } = setup({ denom: UACT_DENOM, denomBalance: 0 });

    fireEvent.click(screen.getByText("Go to Mint / Burn"));

    expect(handleCancel).toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith("/mint-burn");
  });

  function setup(input: { denom: string; denomBalance: number; denomMin?: number }) {
    const handleCancel = vi.fn();
    const onDeploymentDeposit = vi.fn();
    const routerPush = vi.fn();

    const dependencies = {
      useServices: () => ({
        analyticsService: { track: vi.fn() },
        urlService: { mintBurn: () => "/mint-burn", billing: () => "/billing" }
      }),
      useWallet: () => ({ isManaged: false }),
      useWalletBalance: () => ({ balance: { balanceUAKT: 1000000 } }),
      usePricing: () => ({ isLoaded: true, usdToAkt: (v: number) => v }),
      useDenomData: () => ({
        min: input.denomMin ?? 5,
        max: input.denomBalance,
        balance: input.denomBalance,
        label: "ACT"
      }),
      useAddFundsVerifiedLoginRequiredEventHandler: () => (fn: () => void) => fn,
      useRouter: () => ({ push: routerPush })
    } as unknown as typeof DEPENDENCIES;

    render(<DeploymentDepositModal denom={input.denom} handleCancel={handleCancel} onDeploymentDeposit={onDeploymentDeposit} dependencies={dependencies} />);

    return { handleCancel, routerPush };
  }
});
