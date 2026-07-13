import React from "react";
import { IntlProvider } from "react-intl";
import type { Charge } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./FirstPurchaseBonusAlert";
import { FirstPurchaseBonusAlert } from "./FirstPurchaseBonusAlert";

import { render, screen } from "@testing-library/react";

describe(FirstPurchaseBonusAlert.name, () => {
  it("renders nothing when the feature flag is off and disables the transactions query", () => {
    const { container, usePaymentTransactionsQuery } = setup({ flagEnabled: false });

    expect(container).toBeEmptyDOMElement();
    expect(usePaymentTransactionsQuery).toHaveBeenCalledWith(undefined, { enabled: false });
  });

  it("renders nothing until the transactions query succeeds", () => {
    const { container } = setup({ isSuccess: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the user already has a succeeded charge", () => {
    const { container } = setup({ transactions: [mock<Charge>({ status: "succeeded" })] });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the base offer when no amount is entered", () => {
    const { container } = setup({ amount: 0 });

    expect(screen.getByText("First-purchase bonus")).toBeInTheDocument();
    expect(container).toHaveTextContent("Get 10% bonus credits on your first purchase of $100 or more, up to $100.");
    expect(container).not.toHaveTextContent("more to qualify");
  });

  it("shows the offer to users whose only charges failed", () => {
    setup({ amount: 0, transactions: [mock<Charge>({ status: "failed" })] });

    expect(screen.getByText("First-purchase bonus")).toBeInTheDocument();
  });

  it("nudges when the amount is below the qualifying minimum", () => {
    const { container } = setup({ amount: 50 });

    expect(container).toHaveTextContent("Add $50.00 more to qualify.");
  });

  it("previews the bonus and total at a qualifying amount", () => {
    const { container } = setup({ amount: 100 });

    expect(container).toHaveTextContent("You'll receive $110.00 in credits");
    expect(container).toHaveTextContent("$10.00 first-purchase bonus included.");
  });

  it("caps the previewed bonus at $100", () => {
    const { container } = setup({ amount: 10000 });

    expect(container).toHaveTextContent("You'll receive $10,100.00 in credits");
    expect(container).toHaveTextContent("$100.00 first-purchase bonus included.");
  });

  function setup(input?: { amount?: number; flagEnabled?: boolean; isSuccess?: boolean; transactions?: Charge[] }) {
    const useFlag: typeof DEPENDENCIES.useFlag = vi.fn().mockReturnValue(input?.flagEnabled ?? true);

    // UseQueryResult is a discriminated union that neither mock<T>() nor a partial literal can satisfy
    const usePaymentTransactionsQuery = vi.fn(() => ({
      data: { transactions: input?.transactions ?? [] },
      isSuccess: input?.isSuccess ?? true
    })) as unknown as typeof DEPENDENCIES.usePaymentTransactionsQuery;

    const result = render(
      <IntlProvider locale="en-US" defaultLocale="en-US">
        <FirstPurchaseBonusAlert amount={input?.amount ?? 0} dependencies={{ useFlag, usePaymentTransactionsQuery }} />
      </IntlProvider>
    );

    return { ...result, useFlag, usePaymentTransactionsQuery };
  }
});
