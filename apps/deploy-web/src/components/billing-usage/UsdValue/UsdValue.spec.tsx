import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import { roundUsdToCentPrecision, UsdValue } from "./UsdValue";

import { render, screen } from "@testing-library/react";

describe(roundUsdToCentPrecision.name, () => {
  it.each([
    [0.006, 0.01, "$0.01"],
    [0.004, 0, "$0.00"],
    [1.005, 1.01, "$1.01"],
    [19.999976, 20, "$20.00"],
    [1234567.891, 1234567.89, "$1,234,567.89"],
    [-1.005, -1.01, "-$1.01"]
  ])("rounds %s to %s, the cents UsdValue shows as %s", (usd, rounded, shown) => {
    setup({ value: usd });

    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(roundUsdToCentPrecision(usd)).toBe(rounded);
  });

  function setup(input: { value: number }) {
    render(
      <IntlProvider locale="en-US">
        <UsdValue value={input.value} />
      </IntlProvider>
    );
  }
});
