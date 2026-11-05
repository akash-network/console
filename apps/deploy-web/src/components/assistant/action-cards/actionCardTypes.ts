import type { FC } from "react";

import type { AssistantActionOf, AssistantActionType } from "@src/types/assistant";
import type { ActionCardDecision } from "./useActionCardDecision/useActionCardDecision";

export interface ActionCardProps<T extends AssistantActionType> {
  action: AssistantActionOf<T>;
  decision: ActionCardDecision;
}

export type ActionCardComponent<T extends AssistantActionType> = FC<ActionCardProps<T>>;

export type ActionCardRegistry = { [T in AssistantActionType]?: ActionCardComponent<T> };
