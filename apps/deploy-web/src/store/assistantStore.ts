import { atom } from "jotai";

import type { AssistantContext } from "@src/types/assistant";

export type AssistantOpenRequest = {
  context?: Pick<AssistantContext, "dseq">;
  /** Put in the message box for the user to send or edit, unless the user clicked a button that says it asks. */
  question?: string;
  sendsQuestion?: boolean;
};

export type AssistantPanelState = { isOpen: boolean; request: AssistantOpenRequest; openedAt: number };

/** An atom rather than a context so a contextual button anywhere in the tree can open the one panel the app hosts. */
export const assistantPanelAtom = atom<AssistantPanelState>({ isOpen: false, request: {}, openedAt: 0 });
