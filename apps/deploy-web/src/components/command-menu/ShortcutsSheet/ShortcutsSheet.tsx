"use client";
import type { MutableRefObject } from "react";
import { useId } from "react";
import { DialogClose, DialogTitle } from "@akashnetwork/ui/components";
import { X } from "lucide-react";

import type { Shortcut } from "../commandMenuCatalog";
import { COMMAND_PAGES, DEPLOYMENT_START_COMMANDS, goToShortcut, MENU_TOGGLE_SHORTCUT, SHOW_SHORTCUTS_SHORTCUT } from "../commandMenuCatalog";
import { CommandPanel } from "../CommandPanel/CommandPanel";
import { Keycaps } from "../Keycaps/Keycaps";

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  returnFocusRef?: MutableRefObject<Element | null>;
};

type ShortcutGroupProps = {
  title: string;
  rows: { label: string; shortcut: Shortcut }[];
};

const SHORTCUT_GROUPS: ShortcutGroupProps[] = [
  {
    title: "General",
    rows: [
      { label: "Open command menu", shortcut: MENU_TOGGLE_SHORTCUT },
      { label: "Keyboard shortcuts", shortcut: SHOW_SHORTCUTS_SHORTCUT },
      { label: "Close menu or dialog", shortcut: { keys: ["Esc"] } }
    ]
  },
  {
    title: "Actions",
    rows: DEPLOYMENT_START_COMMANDS.map(command => ({ label: command.label, shortcut: command.shortcut }))
  },
  {
    title: "Go to",
    rows: COMMAND_PAGES.map(page => ({ label: page.label, shortcut: goToShortcut(page) }))
  },
  {
    title: "In the command menu",
    rows: [
      { label: "Move selection", shortcut: { keys: ["↑", "↓"] } },
      { label: "Open", shortcut: { keys: ["↵"] } },
      { label: "Cycle filter", shortcut: { keys: ["⇥"] } },
      { label: "Actions only", shortcut: { keys: [">"] } },
      { label: "Deployments only", shortcut: { keys: ["@"] } },
      { label: "Pages only", shortcut: { keys: ["/"] } }
    ]
  }
];

export function ShortcutsSheet({ isOpen, onOpenChange, returnFocusRef }: Props) {
  return (
    <CommandPanel isOpen={isOpen} onOpenChange={onOpenChange} returnFocusRef={returnFocusRef} className="max-w-[700px]">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b pl-5 pr-3">
        <DialogTitle className="text-[15px] font-semibold tracking-normal">Keyboard shortcuts</DialogTitle>
        <DialogClose
          aria-label="Close"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </DialogClose>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 overflow-y-auto overscroll-contain p-5 min-[641px]:grid-cols-2">
        {SHORTCUT_GROUPS.map(group => (
          <ShortcutGroup key={group.title} {...group} />
        ))}
      </div>
    </CommandPanel>
  );
}

function ShortcutGroup({ title, rows }: ShortcutGroupProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="pb-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      <ul>
        {rows.map(row => (
          <li key={row.label} className="flex min-h-9 items-center justify-between gap-4 border-b py-1.5 text-[13.5px] last:border-b-0">
            <span>{row.label}</span>
            <Keycaps {...row.shortcut} />
          </li>
        ))}
      </ul>
    </section>
  );
}
