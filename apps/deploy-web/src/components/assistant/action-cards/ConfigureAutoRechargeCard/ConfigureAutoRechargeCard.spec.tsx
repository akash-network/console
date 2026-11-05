import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import { ConfigureAutoRechargeCard } from "./ConfigureAutoRechargeCard";

import { render, screen } from "@testing-library/react";

describe(ConfigureAutoRechargeCard.name, () => {
  it("opens the billing page's auto recharge setup and never turns it on itself", () => {
    setup({ thresholdUsd: null, amountUsd: null });

    const card = screen.getByRole("region", { name: "Set up auto recharge" });
    expect(screen.getByRole("link", { name: "Open auto recharge" })).toHaveAttribute("href", UrlService.billing({ setupAutoTopUp: true }));
    expect(card).toHaveTextContent("Recharge when balance drops toYou choose on the billing page");
    expect(card).toHaveTextContent("Amount to addYou choose on the billing page");
    expect(card).toHaveTextContent("Nothing is turned on or charged until you save it on the billing page.");
    expect(card).not.toHaveTextContent("Enter the suggested values there yourself.");
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });

  it("shows the suggested threshold and amount for the user to enter", () => {
    setup({ thresholdUsd: 10, amountUsd: 50 });

    const card = screen.getByRole("region", { name: "Set up auto recharge" });
    expect(card).toHaveTextContent("Recharge when balance drops to$10.00");
    expect(card).toHaveTextContent("Amount to add$50.00");
    expect(card).toHaveTextContent("Enter the suggested values there yourself.");
  });

  function setup(input: { thresholdUsd: number | null; amountUsd: number | null }) {
    render(
      <ConfigureAutoRechargeCard
        action={{ type: "configure_auto_recharge", tier: "deep_link", ...input }}
        decision={mock<ActionCardDecision>({ status: "pending", error: null })}
      />
    );
  }
});
