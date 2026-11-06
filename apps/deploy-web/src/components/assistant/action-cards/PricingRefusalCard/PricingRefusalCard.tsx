"use client";
import type { FC } from "react";

import type { AssistantActionType } from "@src/types/assistant";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardComponent, ActionCardProps } from "../actionCardTypes";
import { carriesPricingChange, PRICING_CHANGE_MESSAGE } from "../pricingGuard/pricingGuard";

export const DEPENDENCIES = { ActionCardChrome };

export const PricingRefusalCard: FC<ActionCardProps<AssistantActionType> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => <d.ActionCardChrome title="This change can't be applied" tier={action.tier} decision={decision} irreversibleNote={PRICING_CHANGE_MESSAGE} />;

/** Pricing stays the deployer's choice, so a card refuses any proposal that carries a price or denom, whatever the api let through. */
export function withPricingGuard<T extends AssistantActionType>(Card: ActionCardComponent<T>): ActionCardComponent<T> {
  const GuardedCard: ActionCardComponent<T> = props => (carriesPricingChange(props.action) ? <PricingRefusalCard {...props} /> : <Card {...props} />);
  GuardedCard.displayName = `withPricingGuard(${Card.displayName ?? Card.name})`;
  return GuardedCard;
}
