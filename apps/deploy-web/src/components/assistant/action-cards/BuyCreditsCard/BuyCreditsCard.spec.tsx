import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AddCreditsRequest } from "@src/store/addCreditsStore";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./BuyCreditsCard";
import { BuyCreditsCard, CREDITS_ADDED_MESSAGE } from "./BuyCreditsCard";

import { render } from "@testing-library/react";

describe(BuyCreditsCard.name, () => {
  it("shows the suggested amount and that nothing is charged from the chat", () => {
    const { chromeProps, decision } = setup({ amountUsd: 25 });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Buy credits",
        tier: "deep_link",
        decision,
        rows: [{ label: "Suggested amount", value: "$25.00" }],
        costNote: "You pick the amount and pay with your card in the Add Credits form. Nothing is charged from this chat.",
        confirmLabel: "Add credits"
      })
    );
  });

  it("leaves the amount to the user when the assistant suggests none", () => {
    const { chromeProps } = setup({ amountUsd: null });

    expect(chromeProps().rows).toEqual([{ label: "Suggested amount", value: "Your choice" }]);
  });

  it("opens the billing page's Add Credits form and picks the conversation back up once credits land", async () => {
    const { chromeProps, addCredits, continueConversation } = setup({ amountUsd: 25 });

    await chromeProps().onConfirm!("");

    const request = addCredits.mock.lastCall![0]!;
    expect(request.context).toBe("assistant");
    expect(continueConversation).not.toHaveBeenCalled();
    request.onCreditsAdded!();
    expect(continueConversation).toHaveBeenCalledWith(CREDITS_ADDED_MESSAGE);
  });

  function setup(input: { amountUsd: number | null }) {
    const addCredits = vi.fn((_request?: AddCreditsRequest) => {});
    const continueConversation = vi.fn();
    const ActionCardChrome = vi.fn((_props: ActionCardChromeProps) => null);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <BuyCreditsCard
        action={{ type: "buy_credits", tier: "deep_link", amountUsd: input.amountUsd }}
        decision={decision}
        continueConversation={continueConversation}
        dependencies={{ useAddCredits: () => addCredits, ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], addCredits, continueConversation, decision };
  }
});
