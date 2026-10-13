"use client";
import type { HTMLAttributes } from "react";
import { Fragment } from "react";
import { cn } from "@akashnetwork/ui/utils";

import type { KeyToken, Shortcut } from "../commandMenuCatalog";
import { useIsMac } from "../platformKeys";

export const DEPENDENCIES = { useIsMac };

type Props = Shortcut &
  Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
    dependencies?: typeof DEPENDENCIES;
  };

const SPOKEN_SYMBOLS: Record<string, string> = {
  "↑": "Up arrow",
  "↓": "Down arrow",
  "↵": "Enter",
  "⇥": "Tab",
  Esc: "Escape",
  "?": "Question mark",
  ">": "Greater than",
  "@": "At sign",
  "/": "Slash"
};

export function Keycaps({ keys, isSequence = false, className, dependencies = DEPENDENCIES, ...props }: Props) {
  const isMac = dependencies.useIsMac() ?? false;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)} {...props}>
      {keys.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {isSequence && index > 0 && (
            <span aria-hidden="true" className="text-[11px] text-muted-foreground">
              then
            </span>
          )}
          <kbd
            aria-hidden="true"
            className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] border bg-background px-1.5 font-mono text-[11.5px] font-medium text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]"
          >
            {printKey(key, isMac)}
          </kbd>
        </Fragment>
      ))}
      <span className="sr-only">{keys.map(key => speakKey(key, isMac)).join(isSequence ? " then " : " ")}</span>
    </span>
  );
}

function printKey(key: KeyToken, isMac: boolean) {
  if (key === "mod") return isMac ? "⌘" : "Ctrl";
  if (key === "shift") return isMac ? "⇧" : "Shift";
  return key;
}

function speakKey(key: KeyToken, isMac: boolean) {
  if (key === "mod") return isMac ? "Command" : "Ctrl";
  if (key === "shift") return "Shift";
  return SPOKEN_SYMBOLS[key] ?? key;
}
