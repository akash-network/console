import { useEffect, useRef } from "react";

import type { CommandPage, DeploymentStartCommand } from "./commandMenuCatalog";
import { COMMAND_PAGES, DEPLOYMENT_START_COMMANDS, GO_KEY, SHOW_SHORTCUTS_SHORTCUT } from "./commandMenuCatalog";
import { detectMac, isMenuToggleKey, isShortcutKey } from "./platformKeys";

export interface GlobalShortcutHandlers {
  onToggleMenu: () => void;
  onShowShortcuts: () => void;
  onStartDeployment: (command: DeploymentStartCommand) => void;
  onGoTo: (page: CommandPage) => void;
}

const GO_SEQUENCE_WINDOW_MS = 1200;

const KEY_CONSUMING_TARGETS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"], [role="menubar"], [role="grid"], [role="tree"]';

const OPEN_DIALOGS = '[role="dialog"], [role="alertdialog"]';

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(function keepLatestHandlers() {
    handlersRef.current = handlers;
  });

  useEffect(function listenForShortcuts() {
    const isMac = detectMac(navigator);
    let goPressedAt: number | undefined;

    const runSingleKey = (event: KeyboardEvent) => {
      const startCommand = DEPLOYMENT_START_COMMANDS.find(command => isShortcutKey(event, command.shortcut.keys));
      if (startCommand) {
        handlersRef.current.onStartDeployment(startCommand);
        return true;
      }
      if (isShortcutKey(event, SHOW_SHORTCUTS_SHORTCUT.keys)) {
        handlersRef.current.onShowShortcuts();
        return true;
      }
      return false;
    };

    const runGoTarget = (event: KeyboardEvent) => {
      const page = COMMAND_PAGES.find(candidate => isShortcutKey(event, [candidate.goKey]));
      if (page) handlersRef.current.onGoTo(page);
      return !!page;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (isMenuToggleKey(event, isMac)) {
        event.preventDefault();
        if (!event.repeat) handlersRef.current.onToggleMenu();
        return;
      }

      if (event.repeat) return;

      const isGoSequencePending = goPressedAt !== undefined && Date.now() - goPressedAt <= GO_SEQUENCE_WINDOW_MS;
      goPressedAt = undefined;

      if (isSingleKeyIgnored(event)) return;

      if (isGoSequencePending) {
        if (runGoTarget(event)) event.preventDefault();
        return;
      }

      if (isShortcutKey(event, [GO_KEY])) {
        event.preventDefault();
        goPressedAt = Date.now();
        return;
      }

      if (runSingleKey(event)) event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);

    return function stopListening() {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}

function isSingleKeyIgnored(event: KeyboardEvent) {
  return (
    event.isComposing ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    (event.target instanceof Element && event.target.closest(KEY_CONSUMING_TARGETS) !== null) ||
    document.querySelector(OPEN_DIALOGS) !== null
  );
}
