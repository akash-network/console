"use client";
import type { FC } from "react";

import { useAddCredits } from "@src/hooks/useAddCredits";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { formatUsd } from "../formatUsd";

export const DEPENDENCIES = { useAddCredits, ActionCardChrome };

export const CREDITS_ADDED_MESSAGE = "I added credits.";

/** Opens the same Add Credits sheet as the billing page, where card entry and 3D Secure happen, and picks the conversation back up once the credits land. */
export const BuyCreditsCard: FC<ActionCardProps<"buy_credits"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  continueConversation,
  dependencies: d = DEPENDENCIES
}) => {
  const addCredits = d.useAddCredits();

  return (
    <d.ActionCardChrome
      title="Buy credits"
      tier={action.tier}
      decision={decision}
      rows={[{ label: "Suggested amount", value: action.amountUsd === null ? "Your choice" : formatUsd(action.amountUsd) }]}
      costNote="You pick the amount and pay with your card in the Add Credits form. Nothing is charged from this chat."
      confirmLabel="Add credits"
      successMessage="The Add Credits form is open."
      onConfirm={async () => {
        addCredits({ context: "assistant", onCreditsAdded: () => continueConversation?.(CREDITS_ADDED_MESSAGE) });
      }}
    />
  );
};
