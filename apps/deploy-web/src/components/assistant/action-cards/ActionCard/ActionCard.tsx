"use client";
import type { FC } from "react";

import type { AssistantAction } from "@src/types/assistant";
import { ACTION_CARD_REGISTRY } from "../actionCardRegistry";
import type { ActionCardComponent, ActionCardRegistry } from "../actionCardTypes";
import { GenericActionCard } from "../GenericActionCard/GenericActionCard";
import { useActionCardDecision } from "../useActionCardDecision/useActionCardDecision";

export const DEPENDENCIES = { useActionCardDecision, GenericActionCard };

type Props = {
  conversationId: string | null;
  proposalId: string;
  action: AssistantAction;
  registry?: ActionCardRegistry;
  dependencies?: typeof DEPENDENCIES;
};

/** Renders a proposal from its typed data only, never from the assistant's prose, so nothing the model writes can change what Confirm does. */
export const ActionCard: FC<Props> = ({ conversationId, proposalId, action, registry = ACTION_CARD_REGISTRY, dependencies: d = DEPENDENCIES }) => {
  const decision = d.useActionCardDecision({ conversationId, proposalId, actionType: action.type });
  const Card = registry[action.type] as ActionCardComponent<typeof action.type> | undefined;

  return Card ? <Card action={action} decision={decision} /> : <d.GenericActionCard action={action} decision={decision} />;
};
