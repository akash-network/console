import { useCallback } from "react";
import { useAtom } from "jotai";

import { useFlag } from "@src/hooks/useFlag";
import sdlStore from "@src/store/sdlStore";

export const DEPENDENCIES = { useFlag };

export function useSdlPreviewPanel(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const isEnabled = dependencies.useFlag("ui_sdl_preview_panel");
  const [isOpen, setIsOpen] = useAtom(sdlStore.sdlPreviewOpen);
  const open = useCallback(() => setIsOpen(true), [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);

  return { isEnabled, isOpen, open, close };
}
