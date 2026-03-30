import { describe, expect, it } from "vitest";

import type { DEPENDENCIES } from "./DeploymentMinimumEscrowAlertText";
import { DeploymentMinimumEscrowAlertText } from "./DeploymentMinimumEscrowAlertText";

import { render, screen } from "@testing-library/react";

describe(DeploymentMinimumEscrowAlertText.name, () => {
  it("shows ACT dollar amount for managed wallet when act is supported", () => {
    setup({ isManaged: true, supportsACT: true, denom: "uact", minDeposit: { act: 10, akt: 5, usdc: 5 } });

    expect(screen.getByText("$10")).toBeInTheDocument();
  });

  it("shows ACT dollar amount for managed wallet regardless of supportsACT", () => {
    setup({ isManaged: true, supportsACT: false, denom: "uakt", minDeposit: { act: 10, akt: 5, usdc: 5 } });

    expect(screen.getByText("$10")).toBeInTheDocument();
  });

  it("shows selected denom min deposit for self-custody wallet with uakt", () => {
    setup({ isManaged: false, supportsACT: false, denom: "uakt", minDeposit: { act: 10, akt: 5, usdc: 3 } });

    expect(screen.getByText("5", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("akt", { exact: false })).toBeInTheDocument();
  });

  it("shows selected denom min deposit for self-custody wallet with uact", () => {
    setup({ isManaged: false, supportsACT: true, denom: "uact", minDeposit: { act: 10, akt: 5, usdc: 3 } });

    expect(screen.getByText("10", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("act", { exact: false })).toBeInTheDocument();
  });

  it("shows usdc min deposit for self-custody wallet with ibc denom", () => {
    setup({
      isManaged: false,
      supportsACT: false,
      denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
      minDeposit: { act: 10, akt: 5, usdc: 3 }
    });

    expect(screen.getByText("3", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("usdc", { exact: false })).toBeInTheDocument();
  });

  it("renders nothing for self-custody wallet with unknown denom", () => {
    const { container } = setup({ isManaged: false, supportsACT: false, denom: "unknown", minDeposit: { act: 10, akt: 5, usdc: 3 } });

    expect(container.textContent).toBe("");
  });

  function setup(input: { isManaged: boolean; supportsACT: boolean; denom: string; minDeposit: { act: number; akt: number; usdc: number } }) {
    const dependencies: typeof DEPENDENCIES = {
      useWallet: () => ({ isManaged: input.isManaged }) as ReturnType<typeof DEPENDENCIES.useWallet>,
      useChainParam: () => ({ minDeposit: input.minDeposit }) as ReturnType<typeof DEPENDENCIES.useChainParam>
    };

    return render(<DeploymentMinimumEscrowAlertText denom={input.denom} dependencies={dependencies} />);
  }
});
