import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./FundingImpactReviewSection";
import { FundingImpactReviewSection } from "./FundingImpactReviewSection";
import type { FundingImpact } from "./useFundingImpact";
import type { ReviewRow } from "./useReviewRows";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("FundingImpactReviewSection", () => {
  it("renders nothing while hidden", () => {
    const { container } = setup({ impact: { kind: "hidden" } });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a skeleton of the summary row while loading", () => {
    setup({ impact: { kind: "loading" } });

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("points at Billing without blocking when the balance is unavailable", () => {
    setup({ impact: { kind: "unavailable" } });

    expect(screen.getByText(/Balance details are unavailable right now/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check Billing" })).toHaveAttribute("href", UrlService.billing());
  });

  it("summarizes the escrow and the available after it, without a runtime figure while funding is open-ended", () => {
    setup({ impact: visible() });

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("Escrow ~$144");
    expect(trigger).toHaveTextContent("available after $56");
    expect(trigger).not.toHaveTextContent("of runtime");
  });

  it("summarizes the runtime limit when one is set", () => {
    setup({ impact: visible(), runtimeLimitHours: 12 });
    expect(screen.getByRole("button")).toHaveTextContent("12 hours of runtime");
  });

  it("shows a dash for available after when the balance cannot cover the escrow", () => {
    setup({ impact: visible({ state: "not-enough-available", availableAfterUsd: null }) });
    expect(screen.getByRole("button")).toHaveTextContent("available after —");
  });

  it("expands into the legend, the balance bar, the explainer, and the Billing link", async () => {
    setup({ impact: visible({ thresholdUsd: 20 }) });

    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/Escrow ~ \$144 \(estimate\)/)).toBeInTheDocument();
    expect(screen.getByText("$200")).toBeInTheDocument();
    expect(screen.getByText("available now")).toBeInTheDocument();
    expect(screen.getByTestId("balance-bar")).toHaveTextContent("escrow:144,available:56");
    expect(screen.getByTestId("balance-bar")).toHaveAttribute("data-threshold", "20");
    expect(screen.getByText(/The escrow is held, not charged/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Full balance breakdown in Billing/ })).toHaveAttribute("href", UrlService.billing());
  });

  it("says available stays above the threshold when funded", async () => {
    setup({ impact: visible({ thresholdUsd: 20 }) });

    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/available stays above it, so no credits are purchased/)).toBeInTheDocument();
  });

  it("omits the threshold sentence when no threshold rule applies", async () => {
    setup({ impact: visible({ thresholdUsd: null }) });

    await userEvent.click(screen.getByRole("button"));

    expect(screen.queryByText(/available stays above it/)).not.toBeInTheDocument();
  });

  it("warns which card buys credits when confirming crosses the threshold", async () => {
    setup({ impact: visible({ state: "crosses-threshold", availableAfterUsd: 19, thresholdUsd: 20 }) });

    expect(screen.getByText("Buys credits")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Escrow/ }));

    const callout = screen.getByRole("alert");
    expect(callout).toHaveTextContent("Confirming drops available to $19, below your Auto Top-Up threshold of $20");
    expect(callout).toHaveTextContent("Visa **** 4242 is charged $100 for credits");
  });

  it("prompts for credits without claiming a charge when no payment method is on file", async () => {
    setup({ impact: visible({ state: "no-payment-method", cardLabel: null }) });

    expect(screen.getByText("No payment method")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Escrow/ }));

    expect(screen.getByText(/nothing is charged automatically/)).toBeInTheDocument();
    expect(screen.queryByText(/charged \$/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Credits" })).toHaveAttribute("href", UrlService.billing({ openPayment: true }));
  });

  it("names the trial and its duration without claiming anything about a card", async () => {
    setup({ impact: visible({ state: "trial", trialDurationHours: 12 }) });

    expect(screen.getByText("Trial")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Escrow/ }));

    expect(screen.getByText(/closed automatically after 12 hours/)).toBeInTheDocument();
    expect(screen.queryByText(/payment method/)).not.toBeInTheDocument();
    expect(screen.queryByText(/charged \$/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Credits" })).toHaveAttribute("href", UrlService.billing({ openPayment: true }));
  });

  it("offers credits and drops the bar when the balance cannot cover the escrow", async () => {
    setup({ impact: visible({ state: "not-enough-available", availableAfterUsd: null, availableNowUsd: 100 }) });

    expect(screen.getByText("Not enough available")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Escrow/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Your available balance of $100 can't cover the estimated escrow of ~$144");
    expect(screen.queryByTestId("balance-bar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Credits" })).toHaveAttribute("href", UrlService.billing({ openPayment: true }));
  });

  function visible(overrides?: Partial<Extract<FundingImpact, { kind: "visible" }>>): FundingImpact {
    return {
      kind: "visible",
      state: "funded",
      escrowUsd: 144,
      availableNowUsd: 200,
      availableAfterUsd: 56,
      thresholdUsd: null,
      chargeUsd: 100,
      cardLabel: "Visa **** 4242",
      trialDurationHours: 24,
      ...overrides
    };
  }

  function setup(input: { impact: FundingImpact; runtimeLimitHours?: number }) {
    const useFundingImpact: typeof DEPENDENCIES.useFundingImpact = () => input.impact;
    const BalanceBreakdownBar: typeof DEPENDENCIES.BalanceBreakdownBar = ({ segments, threshold }) => (
      <div data-testid="balance-bar" data-threshold={threshold ?? undefined}>
        {segments.map(segment => `${segment.key}:${segment.amountUsd}`).join(",")}
      </div>
    );
    const UsdValue: typeof DEPENDENCIES.UsdValue = ({ value }) => <>${value}</>;
    const Link: typeof DEPENDENCIES.Link = (({ href, children }: { href: string; children: ReactNode }) => (
      <a href={href}>{children}</a>
    )) as typeof DEPENDENCIES.Link;
    const Skeleton: typeof DEPENDENCIES.Skeleton = () => <div data-testid="skeleton" />;

    return render(
      <FundingImpactReviewSection
        rows={[mock<ReviewRow>({ price: { amount: "0.005", denom: "uakt" } })]}
        runtimeLimitHours={input.runtimeLimitHours}
        dependencies={{ useFundingImpact, BalanceBreakdownBar, UsdValue, Link, Skeleton }}
      />
    );
  }
});
