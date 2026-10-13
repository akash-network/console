import { useEffect, useRef } from "react";

import { detectMac, isMenuToggleKey } from "./platformKeys";

export interface GlobalShortcutHandlers {
  onToggleMenu: () => void;
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(function keepLatestHandlers() {
    handlersRef.current = handlers;
  });

  useEffect(function listenForShortcuts() {
    const isMac = detectMac(navigator);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isMenuToggleKey(event, isMac)) return;

      event.preventDefault();
      handlersRef.current.onToggleMenu();
    };

    window.addEventListener("keydown", handleKeyDown);

    return function stopListening() {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
