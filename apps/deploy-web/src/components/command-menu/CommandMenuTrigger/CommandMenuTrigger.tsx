"use client";
import { Search } from "lucide-react";

import { useIsMac } from "../platformKeys";

export const DEPENDENCIES = { useIsMac };

type Props = {
  onClick: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const LABEL = "Search or run a command";

const MAC_SHORTCUT = { label: "⌘K", ariaKeys: "Meta+K" };

const OTHER_SHORTCUT = { label: "Ctrl K", ariaKeys: "Control+K" };

export function CommandMenuTrigger({ onClick, dependencies = DEPENDENCIES }: Props) {
  const isMac = dependencies.useIsMac();
  const shortcut = isMac === undefined ? undefined : isMac ? MAC_SHORTCUT : OTHER_SHORTCUT;

  return (
    <button
      type="button"
      onClick={onClick}
      title={LABEL}
      aria-label={LABEL}
      aria-haspopup="dialog"
      aria-keyshortcuts={shortcut?.ariaKeys}
      className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-auto sm:justify-start sm:pl-[11px] sm:pr-3"
    >
      <Search className="h-4 w-4" />
      {shortcut && <span className="hidden text-[12.5px] font-medium sm:inline">{shortcut.label}</span>}
    </button>
  );
}
