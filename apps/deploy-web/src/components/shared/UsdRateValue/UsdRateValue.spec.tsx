import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import { UsdRateValue } from "./UsdRateValue";

import { render, screen } from "@testing-library/react";

describe(UsdRateValue.name, () => {
  it("keeps two significant digits of a rate under half a cent", () => {
    setup({ value: 0.00123 });

    expect(screen.getByText("$0.0012")).toBeInTheDocument();
  });

  it("keeps two significant digits of a rate between half a cent and a cent", () => {
    setup({ value: 0.0072 });

    expect(screen.getByText("$0.0072")).toBeInTheDocument();
  });

  it("shows a rate of a cent or more in cents", () => {
    setup({ value: 0.25 });

    expect(screen.getByText("$0.25")).toBeInTheDocument();
  });

  it("shows a rate of a dollar or more in cents", () => {
    setup({ value: 11.9 });

    expect(screen.getByText("$11.90")).toBeInTheDocument();
  });

  it("shows a zero rate in cents", () => {
    setup({ value: 0 });

    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  function setup(input: { value: number }) {
    render(
      <IntlProvider locale="en-US">
        <UsdRateValue value={input.value} />
      </IntlProvider>
    );
  }
});
