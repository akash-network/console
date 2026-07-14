import React from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import { PaymentSuccessAnimation } from "./PaymentSuccessAnimation";

import { render, screen } from "@testing-library/react";

describe(PaymentSuccessAnimation.name, () => {
  it("shows the credited total including the bonus and the bonus note", () => {
    setup({ amount: "100", bonusAmount: "10" });

    expect(screen.getByText("$110.00")).toBeInTheDocument();
    expect(screen.getByText(/\$10\.00 first-purchase bonus/)).toBeInTheDocument();
  });

  it("shows only the paid amount when there is no bonus", () => {
    setup({ amount: "100" });

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.queryByText(/first-purchase bonus/)).not.toBeInTheDocument();
  });

  function setup(input: { amount: string; bonusAmount?: string }) {
    render(
      <IntlProvider locale="en-US" defaultLocale="en-US">
        <PaymentSuccessAnimation show amount={input.amount} bonusAmount={input.bonusAmount} />
      </IntlProvider>
    );
    return input;
  }
});
