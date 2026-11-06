"use client";
import type { FC } from "react";

import { UrlService } from "@src/utils/urlUtils";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { ActionCardChrome };

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const BuyCreditsCard: FC<ActionCardProps<"buy_credits"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => (
  <d.ActionCardChrome
    title="Buy credits"
    tier={action.tier}
    decision={decision}
    rows={[{ label: "Suggested amount", value: action.amountUsd === null ? "Your choice" : usdFormatter.format(action.amountUsd) }]}
    costNote="You pick the amount and pay on the billing page."
    deepLink={{ href: UrlService.billing({ openPayment: true }), label: "Open billing" }}
  />
);
