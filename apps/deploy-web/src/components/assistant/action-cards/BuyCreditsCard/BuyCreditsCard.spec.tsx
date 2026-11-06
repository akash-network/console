import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import { BuyCreditsCard } from "./BuyCreditsCard";

import { render, screen } from "@testing-library/react";

describe("BuyCreditsCard", () => {
  it("links to the billing page with the payment form open and shows the suggested amount", () => {
    setup({ amountUsd: 25 });

    expect(screen.getByRole("region", { name: "Buy credits" })).toHaveTextContent("Suggested amount$25.00");
    expect(screen.getByRole("link", { name: "Open billing" })).toHaveAttribute("href", UrlService.billing({ openPayment: true }));
  });

  it("leaves the amount to the user when the assistant suggests none", () => {
    setup({ amountUsd: null });

    expect(screen.getByRole("region", { name: "Buy credits" })).toHaveTextContent("Suggested amountYour choice");
  });

  function setup(input: { amountUsd: number | null }) {
    render(
      <BuyCreditsCard
        action={{ type: "buy_credits", tier: "deep_link", amountUsd: input.amountUsd }}
        decision={mock<ActionCardDecision>({ status: "pending" })}
      />
    );
  }
});
