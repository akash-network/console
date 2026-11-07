import { describe, expect, it, vi } from "vitest";

import { NeedsFundsAlert } from "./NeedsFundsAlert";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("NeedsFundsAlert", () => {
  it("says how far the balance falls short when the amounts are known", () => {
    setup({ message: "Not enough balance", shortfall: { requiredAmountUsd: 2, availableAmountUsd: 0.5 } });

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

  it("hands Add credits and Try again to the caller", async () => {
    const { onAddCredits, onTryAgain } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Add credits" }));
    expect(onAddCredits).toHaveBeenCalledTimes(1);
    expect(onTryAgain).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  function setup(input: { message?: string; shortfall?: { requiredAmountUsd: number; availableAmountUsd: number } }) {
    const onAddCredits = vi.fn();
    const onTryAgain = vi.fn();
    render(<NeedsFundsAlert message={input.message} shortfall={input.shortfall} onAddCredits={onAddCredits} onTryAgain={onTryAgain} />);
    return { onAddCredits, onTryAgain };
  }
});
