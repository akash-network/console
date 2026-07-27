import { IntlProvider } from "react-intl";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import { PriceEstimateTooltip } from "./PriceEstimateTooltip";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(PriceEstimateTooltip.name, () => {
  it("shows the daily and monthly rates without any block or blockchain wording", async () => {
    const { user, trigger } = setup({});

    await user.hover(trigger);

    expect(await screen.findAllByText(/per day/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/per month/i)).not.toHaveLength(0);
    expect(screen.queryAllByText(/block/i)).toHaveLength(0);
  });

  it("adds the hourly rate when showAsHourly is set", async () => {
    const { user, trigger } = setup({ showAsHourly: true });

    await user.hover(trigger);

    expect(await screen.findAllByText(/per hour/i)).not.toHaveLength(0);
  });

  it("omits the hourly rate by default", async () => {
    const { user, trigger } = setup({});

    await user.hover(trigger);

    expect(await screen.findAllByText(/per month/i)).not.toHaveLength(0);
    expect(screen.queryAllByText(/per hour/i)).toHaveLength(0);
  });

  function setup(input: { showAsHourly?: boolean }) {
    const user = userEvent.setup();
    const { container } = render(
      <TestContainerProvider>
        <IntlProvider locale="en">
          <TooltipProvider>
            <PriceEstimateTooltip value="100" denom="uakt" showAsHourly={input.showAsHourly} />
          </TooltipProvider>
        </IntlProvider>
      </TestContainerProvider>
    );
    return { user, trigger: container.querySelector("svg") as SVGElement };
  }
});
