import { IntlProvider } from "react-intl";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import { MarketplaceCostTooltip } from "./MarketplaceCostTooltip";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(MarketplaceCostTooltip.name, () => {
  it("surfaces the hourly and daily rate for a CPU-only spec, without repeating the monthly rate or mentioning blocks", async () => {
    const { user, trigger } = setup({ gpuCount: 0 });

    await user.hover(trigger);

    expect(await screen.findAllByText(/per hour/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/per day/i)).not.toHaveLength(0);
    expect(screen.queryAllByText(/per month/i)).toHaveLength(0);
    expect(screen.queryAllByText(/block/i)).toHaveLength(0);
  });

  it("surfaces the per-hour-per-GPU and daily rate for a GPU spec", async () => {
    const { user, trigger } = setup({ gpuCount: 2 });

    await user.hover(trigger);

    expect(await screen.findAllByText(/per hour \/ GPU/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/per day/i)).not.toHaveLength(0);
    expect(screen.queryAllByText(/per month/i)).toHaveLength(0);
  });

  function setup(input: { gpuCount: number }) {
    const user = userEvent.setup();
    const { container } = render(
      <TestContainerProvider>
        <IntlProvider locale="en">
          <TooltipProvider>
            <MarketplaceCostTooltip perBlockValue={0.0001} denom="uakt" gpuCount={input.gpuCount} />
          </TooltipProvider>
        </IntlProvider>
      </TestContainerProvider>
    );
    return { user, trigger: container.querySelector("svg") as SVGElement };
  }
});
