import type { FC } from "react";

import type { AssistantActionOf, AssistantActionType } from "@src/types/assistant";
import type { ActionCardDecision } from "./useActionCardDecision/useActionCardDecision";

export interface ActionCardProps<T extends AssistantActionType> {
  action: AssistantActionOf<T>;
  decision: ActionCardDecision;
  /** Sends a message on the user's behalf, for a card whose flow ends outside the panel, such as a purchase. */
  continueConversation?: (message: string) => void;
}

export type ActionCardComponent<T extends AssistantActionType> = FC<ActionCardProps<T>>;

export type ActionCardRegistry = { [T in AssistantActionType]?: ActionCardComponent<T> };
