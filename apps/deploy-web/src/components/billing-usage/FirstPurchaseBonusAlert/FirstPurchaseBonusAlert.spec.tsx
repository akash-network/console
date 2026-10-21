import React from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./FirstPurchaseBonusAlert";
import { FirstPurchaseBonusAlert } from "./FirstPurchaseBonusAlert";

import { render, screen } from "@testing-library/react";

describe(FirstPurchaseBonusAlert.name, () => {
  it("renders nothing until eligibility is known, including when the request is refused", () => {
    const { container } = setup({ isSuccess: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the next purchase would not earn the bonus", () => {
    const { container } = setup({ amount: 100, eligible: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the base offer and qualifying threshold when no amount is entered", () => {
    const { container } = setup({ amount: 0 });

    expect(screen.getByText("First-purchase bonus")).toBeInTheDocument();
    expect(container).toHaveTextContent("Get 10% in bonus credits on your first purchase, up to $100.");
    expect(container).toHaveTextContent("Add $100.00 or more to unlock your bonus.");
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

  it("shows when the offer ends and pitches the next purchase while a bonus window is open", () => {
    const { container } = setup({ amount: 0, endsAt: "2026-10-26T18:00:00.000Z" });

    expect(container).toHaveTextContent("Get 10% in bonus credits on your next purchase, up to $100.");
    expect(container).toHaveTextContent(/Offer ends October 26, 2026.*6:00\sPM UTC\./);
  });

  it("shows when the offer ends next to the bonus preview at a qualifying amount", () => {
    const { container } = setup({ amount: 100, endsAt: "2026-10-26T18:00:00.000Z" });

    expect(screen.getByText("$110.00 in credits")).toBeInTheDocument();
    expect(container).toHaveTextContent(/Offer ends October 26, 2026/);
  });

  it("shows no end date when the offer lasts until the first purchase", () => {
    const { container } = setup({ amount: 100, endsAt: null });

    expect(container).not.toHaveTextContent("Offer ends");
  });

  function setup(input?: { amount?: number; isSuccess?: boolean; eligible?: boolean; endsAt?: string | null }) {
    const isSuccess = input?.isSuccess ?? true;
    const useFirstPurchaseBonusQuery = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useFirstPurchaseBonusQuery>>({
        data: isSuccess ? { eligible: input?.eligible ?? true, endsAt: input?.endsAt } : undefined,
        isSuccess
      })
    );

    return render(
      <IntlProvider locale="en-US" defaultLocale="en-US" timeZone="UTC">
        <FirstPurchaseBonusAlert amount={input?.amount ?? 0} dependencies={{ useFirstPurchaseBonusQuery }} />
      </IntlProvider>
    );
  }
});
