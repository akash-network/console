import { atom } from "jotai";

import type { AssistantContext } from "@src/types/assistant";

export type AssistantOpenRequest = {
  context?: Pick<AssistantContext, "dseq">;
  /** Put in the message box for the user to send or edit, never sent on their behalf. */
  question?: string;
};

export type AssistantPanelState = { isOpen: boolean; request: AssistantOpenRequest; openedAt: number };

/** An atom rather than a context so a contextual button anywhere in the tree can open the one panel the app hosts. */
export const assistantPanelAtom = atom<AssistantPanelState>({ isOpen: false, request: {}, openedAt: 0 });
