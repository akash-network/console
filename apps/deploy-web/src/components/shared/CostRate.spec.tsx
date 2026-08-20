import { IntlProvider } from "react-intl";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import { CostRate } from "./CostRate";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

/** 1 ACT per block, which works out to $590.36 per hour and $431,249.07 per month. */
const ONE_ACT_PER_BLOCK = 1_000_000;

describe(CostRate.name, () => {
  it("headlines the hourly rate for a GPU spec and keeps the monthly rate as a subline", () => {
    setup({ gpuCount: 2 });

    expect(screen.getByText("/hr")).toBeInTheDocument();
    expect(screen.getByText("$590.36")).toBeInTheDocument();
    expect(screen.getByText("/month")).toBeInTheDocument();
    expect(screen.getByText("$431,249.07")).toBeInTheDocument();
  });

  it("shows only the monthly rate for a CPU-only spec so an inexpensive deployment doesn't read as $0.00/hr", () => {
    setup({ gpuCount: 0 });

    expect(screen.getByText("/month")).toBeInTheDocument();
    expect(screen.getByText("$431,249.07")).toBeInTheDocument();
    expect(screen.queryByText("/hr")).not.toBeInTheDocument();
  });

  it("divides the hourly rate across the GPUs in the breakdown tooltip", async () => {
    const { user, trigger } = setup({ gpuCount: 2 });

    await user.hover(trigger);

    expect(await screen.findAllByText(/per hour \/ GPU/i)).not.toHaveLength(0);
    expect(screen.getAllByText("$295.18")).not.toHaveLength(0);
  });

  it("offers the plain hourly rate in the breakdown tooltip for a CPU-only spec", async () => {
    const { user, trigger } = setup({ gpuCount: 0 });

    await user.hover(trigger);

    expect(await screen.findAllByText(/per hour/i)).not.toHaveLength(0);
    expect(screen.queryAllByText(/per hour \/ GPU/i)).toHaveLength(0);
  });

  function setup(input: { gpuCount: number; perBlockUDenom?: number }) {
    const user = userEvent.setup();
    const { container } = render(
      <TestContainerProvider>
        <IntlProvider locale="en">
          <TooltipProvider>
            <CostRate perBlockUDenom={input.perBlockUDenom ?? ONE_ACT_PER_BLOCK} denom="uact" gpuCount={input.gpuCount} />
          </TooltipProvider>
        </IntlProvider>
      </TestContainerProvider>
    );
    return { user, trigger: container.querySelector("svg[data-state]") as SVGElement };
  }
});
