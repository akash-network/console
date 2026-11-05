import { useCallback } from "react";
import { useAtom } from "jotai";

import type { AssistantOpenRequest } from "@src/store/assistantStore";
import { assistantPanelAtom } from "@src/store/assistantStore";

export function useAssistantPanel() {
  const [panel, setPanel] = useAtom(assistantPanelAtom);

  const open = useCallback((request: AssistantOpenRequest = {}) => setPanel({ isOpen: true, request, openedAt: Date.now() }), [setPanel]);

  const close = useCallback(() => setPanel(current => ({ ...current, isOpen: false })), [setPanel]);

  return { ...panel, open, close };
}
