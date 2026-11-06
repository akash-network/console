"use client";
import type { FC } from "react";

import { UrlService } from "@src/utils/urlUtils";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { formatUsd } from "../formatUsd";

export const DEPENDENCIES = { ActionCardChrome };

const YOUR_CHOICE = "You choose on the billing page";

export const ConfigureAutoRechargeCard: FC<ActionCardProps<"configure_auto_recharge"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const hasSuggestion = action.thresholdUsd !== null || action.amountUsd !== null;

  return (
    <d.ActionCardChrome
      title="Set up auto recharge"
      tier={action.tier}
      decision={decision}
      rows={[
        { label: "Recharge when balance drops to", value: action.thresholdUsd === null ? YOUR_CHOICE : formatUsd(action.thresholdUsd) },
        { label: "Amount to add", value: action.amountUsd === null ? YOUR_CHOICE : formatUsd(action.amountUsd) }
      ]}
      costNote={[
        "Auto recharge charges your default card automatically when your balance runs low. Nothing is turned on or charged until you save it on the billing page.",
        hasSuggestion ? "Enter the suggested values there yourself." : null
      ]
        .filter(Boolean)
        .join(" ")}
      deepLink={{ href: UrlService.billing({ setupAutoTopUp: true }), label: "Open auto recharge" }}
    />
  );
};
