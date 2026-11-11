import { describe, expect, it, vi } from "vitest";

import type { NeedsFundsVariant } from "../needsFundsVariant/needsFundsVariant";
import { NeedsFundsAlert } from "./NeedsFundsAlert";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(NeedsFundsAlert.name, () => {
  it("says the free trial credit is used up and that credits are needed to deploy", () => {
    setup({ variant: { name: "trial_credit_used_up" }, shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 } });

    expect(screen.getByRole("alert")).toHaveTextContent("Your free trial credit is used up");
    expect(screen.getByRole("alert")).toHaveTextContent("Add credits to deploy. Your deployment carries on from here once they land.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("short");
  });

  it("says the free trial credit left is below the minimum any deployment needs, so a new configuration won't help", () => {
    setup({
      variant: { name: "trial_credit_below_minimum", availableAmountUsd: 0.43, minimumDepositUsd: 0.5 },
      shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.43 }
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Your free trial credit is below the deployment minimum");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You have $0.43 of free trial credit left, and every deployment needs at least $0.50 up front, so changing the configuration won't help. Add credits to deploy."
    );
  });

  it("says how far the balance falls short when the amounts are known", () => {
    setup({ message: "Not enough balance", shortfall: { requiredAmountUsd: 2, availableAmountUsd: 0.5 } });

    expect(screen.getByRole("alert")).toHaveTextContent("Add credits to deploy");
    expect(screen.getByRole("alert")).toHaveTextContent("Starting this deployment takes $2.00 and your balance has $0.50, so you're $1.50 short.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Not enough balance");
  });

  it("shows the refusal's own reason when the amounts are unknown", () => {
    setup({ message: "Add funds to unlock GPU interconnect" });

    expect(screen.getByRole("alert")).toHaveTextContent("Add funds to unlock GPU interconnect");
  });

  it("falls back to a plain explanation when the refusal carries no reason", () => {
    setup({});

    expect(screen.getByRole("alert")).toHaveTextContent("Your balance doesn't cover this deployment yet. Add credits, then try again.");
  });

  it("hands Add credits to the caller and offers no retry while the caller has none", async () => {
    const { onAddCredits } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));

    expect(onAddCredits).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("hands Try again to the caller once it offers a retry", async () => {
    const onTryAgain = vi.fn();
    const { onAddCredits } = setup({ onTryAgain });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onAddCredits).not.toHaveBeenCalled();
  });

  function setup(input: {
    variant?: NeedsFundsVariant;
    message?: string;
    shortfall?: { requiredAmountUsd: number; availableAmountUsd: number };
    onTryAgain?: () => void;
  }) {
    const onAddCredits = vi.fn();
    render(
      <NeedsFundsAlert
        variant={input.variant ?? { name: "not_enough_balance" }}
        message={input.message}
        shortfall={input.shortfall}
        onAddCredits={onAddCredits}
        onTryAgain={input.onTryAgain}
      />
    );
    return { onAddCredits };
  }
});
