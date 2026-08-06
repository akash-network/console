import { describe, expect, it } from "vitest";

import type { DEPENDENCIES } from "./DeploymentMinimumEscrowAlertText";
import { DeploymentMinimumEscrowAlertText } from "./DeploymentMinimumEscrowAlertText";

import { render, screen } from "@testing-library/react";

describe(DeploymentMinimumEscrowAlertText.name, () => {
  it("shows the minimum escrow amount in dollars", () => {
    setup({ minDeposit: { act: 10, akt: 5, usdc: 5 } });

    expect(screen.getByText("$10", { exact: false })).toBeInTheDocument();
  });

  function setup(input: { minDeposit: { act: number; akt: number; usdc: number } }) {
    const dependencies: typeof DEPENDENCIES = {
      useChainParam: () => ({ minDeposit: input.minDeposit }) as ReturnType<typeof DEPENDENCIES.useChainParam>
    };

    return render(<DeploymentMinimumEscrowAlertText dependencies={dependencies} />);
  }
});
