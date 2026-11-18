import { describe, expect, it, vi } from "vitest";

import { type DEPENDENCIES, FundingBanner } from "./FundingBanner";

import { fireEvent, render, screen } from "@testing-library/react";

describe(FundingBanner.name, () => {
  it("offers the first-purchase bonus while the trial can still deploy", () => {
    setup({ isOutOfDeployCredit: false });

    expect(screen.getByRole("button")).toHaveTextContent("Get $100");
    expect(screen.queryByText("Your free trial credit is used up")).not.toBeInTheDocument();
  });

  it("opens the app-wide Add Credits sheet on the purchase tab on click, recorded as opened from the funding banner", () => {
    const { openAddCredits } = setup({ isOutOfDeployCredit: false });

    fireEvent.click(screen.getByRole("button"));

    expect(openAddCredits).toHaveBeenCalledWith({
      initialTab: "purchase",
      description: expect.stringContaining("You're on the free plan"),
      context: "funding_banner"
    });
  });

  describe("when the trial has no credit left to deploy with", () => {
    it("says the free trial credit is used up and that adding credits keeps the user deploying", () => {
      setup({ isOutOfDeployCredit: true });

      expect(screen.getByRole("button")).toHaveTextContent("Your free trial credit is used up");
      expect(screen.getByRole("button")).toHaveTextContent("Add credits to keep deploying");
      expect(screen.getByRole("button")).toHaveClass("bg-warning");
      expect(screen.queryByText("Get $100")).not.toBeInTheDocument();
    });

    it("opens the Add Credits sheet on the purchase tab on click, recorded as opened from the used-up banner", () => {
      const { openAddCredits } = setup({ isOutOfDeployCredit: true });

      fireEvent.click(screen.getByRole("button"));

      expect(openAddCredits).toHaveBeenCalledWith({
        initialTab: "purchase",
        description: expect.stringContaining("Your free trial credit is used up"),
        context: "funding_banner_trial_credit_used_up"
      });
    });
  });

  function setup(input: { isOutOfDeployCredit: boolean }) {
    const openAddCredits = vi.fn();
    const useAddCredits: typeof DEPENDENCIES.useAddCredits = () => openAddCredits;
    const useIsOutOfDeployCredit: typeof DEPENDENCIES.useIsOutOfDeployCredit = () => input.isOutOfDeployCredit;

    render(<FundingBanner dependencies={{ useAddCredits, useIsOutOfDeployCredit }} />);

    return { openAddCredits };
  }
});
