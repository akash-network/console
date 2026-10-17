import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import { PriceValue } from "./PriceValue";

import { render, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(PriceValue.name, () => {
  it("shows the digits of a price under a cent instead of rounding it to $0.00", () => {
    setup({ value: 0.00118 });

    expect(screen.getByText("$0.0012")).toBeInTheDocument();
  });

  it("rounds a price of a cent or more up to the next tenth of a cent before showing it in cents", () => {
    setup({ value: 1.2441 });

    expect(screen.getByText("$1.25")).toBeInTheDocument();
  });

  it("shows a zero price as $0.00", () => {
    setup({ value: 0 });

    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  function setup(input: { value: number }) {
    render(
      <TestContainerProvider>
        <IntlProvider locale="en">
          <PriceValue value={input.value} denom="uact" />
        </IntlProvider>
      </TestContainerProvider>
    );
  }
});
