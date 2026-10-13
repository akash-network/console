"use client";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Command, CommandGroup, CommandInput, CommandItem as CommandRow, CommandList, DialogTitle } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CornerDownLeft } from "lucide-react";

import { useServices } from "@src/context/ServicesProvider";
import type { ScopePrefix } from "../commandMenuSearch";
import { applyScope, cycleScope, parseQuery, rankSections } from "../commandMenuSearch";
import { CommandPanel } from "../CommandPanel/CommandPanel";
import { Keycaps } from "../Keycaps/Keycaps";
import type { CommandItem } from "../useCommandMenuItems";
import { useCommandMenuItems } from "../useCommandMenuItems";

export const DEPENDENCIES = { useCommandMenuItems };

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onShowShortcuts: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const SCOPE_TOGGLES: { prefix: ScopePrefix; label: string }[] = [
  { prefix: ">", label: "actions" },
  { prefix: "@", label: "deployments" },
  { prefix: "/", label: "pages" }
];

const PLACEHOLDER = "Search or run a command (try “>” for actions)";

export function CommandMenuDialog({ isOpen, onOpenChange, onShowShortcuts, dependencies = DEPENDENCIES }: Props) {
  const skipsFocusReturnRef = useRef(false);

  return (
    <CommandPanel
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="max-w-[640px]"
      onCloseAutoFocus={event => {
        if (skipsFocusReturnRef.current) event.preventDefault();
        skipsFocusReturnRef.current = false;
      }}
    >
      <DialogTitle className="sr-only">Command menu</DialogTitle>
      <CommandMenuPanel
        onClose={() => onOpenChange(false)}
        onShowShortcuts={onShowShortcuts}
        onRunItem={item => {
          skipsFocusReturnRef.current = !item.staysOnPage;
          onOpenChange(false);
        }}
        dependencies={dependencies}
      />
    </CommandPanel>
  );
}

type PanelProps = {
  onClose: () => void;
  onShowShortcuts: () => void;
  onRunItem: (item: CommandItem) => void;
  dependencies: typeof DEPENDENCIES;
};

function CommandMenuPanel({ onClose, onShowShortcuts, onRunItem, dependencies }: PanelProps) {
  const { analyticsService } = useServices();
  const [input, setInput] = useState("");
  const [selection, setSelection] = useState({ value: "", isPinnedToFirst: true });
  const parsed = parseQuery(input);
  const sections = rankSections(dependencies.useCommandMenuItems({ parsed, onShowShortcuts }), parsed);
  const rows = sections.flatMap(section => section.items);
  const firstId = rows[0]?.id ?? "";
  const isMovedSelectionShown = !selection.isPinnedToFirst && rows.some(row => row.id === selection.value);
  const selectedValue = isMovedSelectionShown ? selection.value : firstId;
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(function pointInputAtSelectedRow() {
    syncActiveDescendant(commandRef.current, selectedValue);
  });

  const changeInput = (nextInput: string) => {
    setInput(nextInput);
    setSelection({ value: "", isPinnedToFirst: true });
  };

  const runItem = (item: CommandItem) => {
    analyticsService.track("command_menu_action_ran", { action: item.action, via: "menu" });
    onRunItem(item);
    item.run();
  };

  return (
    <Command
      ref={commandRef}
      label="Command menu"
      shouldFilter={false}
      loop
      vimBindings={false}
      value={selectedValue}
      onValueChange={value => setSelection({ value, isPinnedToFirst: value === firstId })}
      className="rounded-none bg-transparent"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b pr-3 [&_[cmdk-input-wrapper]]:flex-1 [&_[cmdk-input-wrapper]]:border-b-0 [&_[cmdk-input-wrapper]]:px-4">
        <CommandInput
          value={input}
          onValueChange={changeInput}
          placeholder={PLACEHOLDER}
          className="h-14 text-[15px]"
          onKeyDown={event => {
            if (event.key !== "Tab") return;
            event.preventDefault();
            event.stopPropagation();
            changeInput(cycleScope(input, event.shiftKey ? -1 : 1));
          }}
        />
        <button
          type="button"
          aria-label="Close (esc)"
          onMouseDown={keepInputFocused}
          onClick={onClose}
          className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          esc
        </button>
      </div>

      <CommandList className="max-h-[min(440px,58vh)] overscroll-contain px-2 pb-2 pt-0.5">
        {sections.map(section => (
          <CommandGroup
            key={section.key}
            heading={section.label}
            className="p-0 pt-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]"
          >
            {section.items.map(item => (
              <CommandMenuRow key={item.id} item={item} onSelect={() => runItem(item)} />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      <p role="status" className="px-3 py-10 text-center text-sm text-muted-foreground empty:p-0">
        {rows.length === 0 && describeNoResults(input)}
      </p>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3.5">
          <FooterHint keys="↑↓">navigate</FooterHint>
          <FooterHint keys="↵">open</FooterHint>
          <FooterHint keys="⇥">filter</FooterHint>
        </div>
        <div className="flex items-center gap-1 max-[600px]:hidden">
          {SCOPE_TOGGLES.map(({ prefix, label }) => {
            const isActive = parsed.prefix === prefix;

            return (
              <button
                key={prefix}
                type="button"
                aria-pressed={isActive}
                onMouseDown={keepInputFocused}
                onClick={() => changeInput(applyScope(input, isActive ? null : prefix))}
                className="rounded-md px-1.5 py-0.5 aria-pressed:bg-muted aria-pressed:text-foreground hover:bg-muted hover:text-foreground"
              >
                <span className="font-mono">{prefix}</span> {label}
              </button>
            );
          })}
        </div>
      </div>
    </Command>
  );
}

function CommandMenuRow({ item, onSelect }: { item: CommandItem; onSelect: () => void }) {
  const Icon = item.icon;

  return (
    <CommandRow
      value={item.id}
      onSelect={onSelect}
      onMouseDown={keepInputFocused}
      className="group h-10 cursor-pointer gap-3 rounded-lg px-2.5 py-0 aria-selected:bg-muted aria-selected:text-foreground"
    >
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center text-muted-foreground">
        {item.statusDotClassName ? (
          <span data-status-dot className={cn("h-2 w-2 rounded-full", item.statusDotClassName)} />
        ) : (
          Icon && <Icon className="h-4 w-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span data-monospace={item.isMonospace || undefined} className="truncate text-sm font-medium data-[monospace]:font-mono data-[monospace]:text-[13px]">
          {item.label}
        </span>
        {item.meta && <span className="truncate text-[12.5px] text-muted-foreground max-[600px]:hidden">{item.meta}</span>}
      </span>
      {item.shortcut && <Keycaps {...item.shortcut} aria-hidden="true" />}
      <span className="flex w-[18px] shrink-0 justify-center">
        <CornerDownLeft className="invisible h-[15px] w-[15px] text-muted-foreground group-data-[selected=true]:visible" />
      </span>
    </CommandRow>
  );
}

function FooterHint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="font-mono text-[11px]">{keys}</kbd>
      {children}
    </span>
  );
}

function describeNoResults(input: string) {
  const typedQuery = applyScope(input, null).trim();

  return typedQuery ? `No results for “${typedQuery}”` : "No results";
}

/** cmdk 1.0.0 reads the input's active descendant once, before any row exists, so it never reaches assistive tech. */
function syncActiveDescendant(command: HTMLElement | null, selectedValue: string) {
  const input = command?.querySelector("[cmdk-input]");
  const selectedRow = command?.querySelector(`[cmdk-item][data-value="${encodeURIComponent(selectedValue)}"]`);

  if (selectedRow) {
    input?.setAttribute("aria-activedescendant", selectedRow.id);
  } else {
    input?.removeAttribute("aria-activedescendant");
  }
}

function keepInputFocused(event: MouseEvent) {
  event.preventDefault();
}
