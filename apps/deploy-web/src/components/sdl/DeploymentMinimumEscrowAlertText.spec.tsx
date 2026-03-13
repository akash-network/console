import { describe, expect, it } from "vitest";

import type { DEPENDENCIES } from "./DeploymentMinimumEscrowAlertText";
import { DeploymentMinimumEscrowAlertText } from "./DeploymentMinimumEscrowAlertText";

import { render, screen } from "@testing-library/react";

describe(DeploymentMinimumEscrowAlertText.name, () => {
  it("shows ACT dollar amount when act is supported regardless of wallet type", () => {
    setup({ isManaged: true, minDeposit: { act: 10 } });

    expect(screen.getByText("$10")).toBeInTheDocument();
  });

  it("shows ACT dollar amount for custodial wallet when act is supported", () => {
    setup({ isManaged: false, minDeposit: { act: 10 } });

    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.queryByText(/ACT/)).not.toBeInTheDocument();
  });

  it("shows USDC dollar amount for managed wallet when act is not supported", () => {
    setup({ isManaged: true, minDeposit: { akt: 5, usdc: 5 } });

    expect(screen.getByText("$5")).toBeInTheDocument();
  });

  it("shows AKT and USDC for custodial wallet when act is not supported", () => {
    setup({ isManaged: false, minDeposit: { akt: 5, usdc: 3 } });

    expect(screen.getByText("5 AKT or 3 USDC")).toBeInTheDocument();
    expect(screen.queryByText(/ACT/)).not.toBeInTheDocument();
  });

  function setup(input: { isManaged: boolean; minDeposit: { act: number } | { akt: number; usdc: number } }) {
    const dependencies: typeof DEPENDENCIES = {
      useWallet: () => ({ isManaged: input.isManaged }) as ReturnType<typeof DEPENDENCIES.useWallet>,
      useChainParam: () => ({ minDeposit: input.minDeposit }) as ReturnType<typeof DEPENDENCIES.useChainParam>
    };

    render(<DeploymentMinimumEscrowAlertText dependencies={dependencies} />);
  }
});
