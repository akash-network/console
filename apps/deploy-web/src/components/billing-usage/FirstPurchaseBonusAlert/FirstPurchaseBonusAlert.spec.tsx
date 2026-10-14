import React from "react";
import { IntlProvider } from "react-intl";
import type { BillingTransaction } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./FirstPurchaseBonusAlert";
import { FirstPurchaseBonusAlert } from "./FirstPurchaseBonusAlert";

import { render, screen } from "@testing-library/react";

describe(FirstPurchaseBonusAlert.name, () => {
  it("renders nothing until the transactions query succeeds", () => {
    const { container } = setup({ isSuccess: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the user already has a succeeded charge", () => {
    const { container } = setup({ transactions: [mock<BillingTransaction>({ status: "succeeded" })] });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the base offer and qualifying threshold when no amount is entered", () => {
    const { container } = setup({ amount: 0 });

    expect(screen.getByText("First-purchase bonus")).toBeInTheDocument();
    expect(container).toHaveTextContent("Get 10% in bonus credits on your first purchase, up to $100.");
    expect(container).toHaveTextContent("Add $100.00 or more to unlock your bonus.");
  });

  it("shows the offer to users whose only charges failed", () => {
    setup({ amount: 0, transactions: [mock<BillingTransaction>({ status: "failed" })] });

    expect(screen.getByText("First-purchase bonus")).toBeInTheDocument();
  });

  it("nudges to add the shortfall when the amount is below the qualifying minimum", () => {
    const { container } = setup({ amount: 50 });

    expect(container).toHaveTextContent("Add $50.00 more to unlock your bonus.");
  });

  it("previews the total, purchase, and bonus breakdown at a qualifying amount", () => {
    setup({ amount: 100 });

    expect(screen.getByText("You'll receive")).toBeInTheDocument();
    expect(screen.getByText("$110.00 in credits")).toBeInTheDocument();
    expect(screen.getByText("First-purchase bonus (10%)")).toBeInTheDocument();
    expect(screen.getByText("+$10.00")).toBeInTheDocument();
  });

  it("nudges toward the max bonus when the bonus is not yet capped", () => {
    const { container } = setup({ amount: 100 });

    expect(container).toHaveTextContent("Add $900.00 more to unlock the full $100.00 bonus.");
  });

  it("caps the previewed bonus at $100 and confirms the max bonus is unlocked", () => {
    const { container } = setup({ amount: 10000 });

    expect(screen.getByText("$10,100.00 in credits")).toBeInTheDocument();
    expect(screen.getByText("+$100.00")).toBeInTheDocument();
    expect(container).toHaveTextContent("You've unlocked the maximum $100.00 bonus.");
    expect(container).not.toHaveTextContent("more to unlock");
  });

  it("judges the offer by the purchase history without asking for eligibility while organizations are off", () => {
    const { useFirstPurchaseBonusQuery } = setup({ amount: 0 });

    expect(screen.getByText("First-purchase bonus")).toBeInTheDocument();
    expect(useFirstPurchaseBonusQuery).not.toHaveBeenCalled();
  });

  describe("when organizations are on", () => {
    it("shows the offer when the caller is eligible", () => {
      const { usePaymentTransactionsQuery } = setup({
        amount: 100,
        isOrganizationsEnabled: true,
        bonus: { isSuccess: true, eligible: true },
        transactions: [mock<BillingTransaction>({ status: "succeeded" })]
      });

      expect(screen.getByText("$110.00 in credits")).toBeInTheDocument();
      expect(usePaymentTransactionsQuery).not.toHaveBeenCalled();
    });

    it("renders nothing when the caller is not eligible", () => {
      const { container } = setup({ amount: 100, isOrganizationsEnabled: true, bonus: { isSuccess: true, eligible: false } });

      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing until eligibility is known, including when the request is refused", () => {
      const { container } = setup({ amount: 100, isOrganizationsEnabled: true, bonus: { isSuccess: false } });

      expect(container).toBeEmptyDOMElement();
    });
  });

  function setup(input?: {
    amount?: number;
    isSuccess?: boolean;
    transactions?: BillingTransaction[];
    isOrganizationsEnabled?: boolean;
    bonus?: { isSuccess: boolean; eligible?: boolean };
  }) {
    // UseQueryResult is a discriminated union that neither mock<T>() nor a partial literal can satisfy
    const usePaymentTransactionsQuery = vi.fn(() => ({
      data: { transactions: input?.transactions ?? [] },
      isSuccess: input?.isSuccess ?? true
    })) as unknown as typeof DEPENDENCIES.usePaymentTransactionsQuery;
    const useFirstPurchaseBonusQuery = vi.fn(() => ({
      data: input?.bonus?.isSuccess ? { eligible: input.bonus.eligible } : undefined,
      isSuccess: input?.bonus?.isSuccess ?? false
    })) as unknown as typeof DEPENDENCIES.useFirstPurchaseBonusQuery;
    const useFlag: typeof DEPENDENCIES.useFlag = flag => flag === "organizations" && !!input?.isOrganizationsEnabled;

    const result = render(
      <IntlProvider locale="en-US" defaultLocale="en-US">
        <FirstPurchaseBonusAlert amount={input?.amount ?? 0} dependencies={{ useFlag, usePaymentTransactionsQuery, useFirstPurchaseBonusQuery }} />
      </IntlProvider>
    );

    return { ...result, usePaymentTransactionsQuery, useFirstPurchaseBonusQuery };
  }
});
