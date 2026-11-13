"use client";
import type { FC } from "react";
import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { Hash, KeyRound, List, Lock, ToggleLeft, Type } from "lucide-react";

import type { TemplateAskedValue } from "@src/types/marketplace-template";

const TYPE_ICONS: Record<TemplateAskedValue["type"], LucideIcon> = {
  text: Type,
  number: Hash,
  boolean: ToggleLeft,
  choice: List,
  secret: KeyRound
};

const CHIP_CLASSES = "inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[11px] font-medium";

export interface AskedValuesListProps {
  askedValues: TemplateAskedValue[];
}

export const AskedValuesList: FC<AskedValuesListProps> = ({ askedValues }) => {
  const headingId = useId();

  if (askedValues.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-[14px] border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3.5">
        <h2 id={headingId} className="text-base font-semibold">
          Variables
        </h2>
        <p className="text-[13px] text-muted-foreground">You fill these in on the next step</p>
      </header>
      <ul className="divide-y divide-border px-5">
        {askedValues.map(askedValue => (
          <AskedValueRow key={askedValue.key} askedValue={askedValue} />
        ))}
      </ul>
    </section>
  );
};

const AskedValueRow: FC<{ askedValue: TemplateAskedValue }> = ({ askedValue }) => {
  const Icon = TYPE_ICONS[askedValue.type];

  return (
    <li className="flex flex-wrap items-start gap-3 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{askedValue.label}</span>
          {askedValue.required && <span className={CHIP_CLASSES}>Required</span>}
          {askedValue.type === "secret" && (
            <span className={`${CHIP_CLASSES} border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400`}>
              <Lock className="h-3 w-3" aria-hidden="true" />
              Secret
            </span>
          )}
        </p>
        {askedValue.help && <p className="text-[13px] text-muted-foreground">{askedValue.help}</p>}
      </div>
      <div className="flex min-w-0 max-w-full flex-col items-end gap-1 sm:max-w-[45%]">
        <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{askedValue.key}</code>
        <span className="max-w-full truncate font-mono text-xs text-muted-foreground">{describeAnswer(askedValue)}</span>
      </div>
    </li>
  );
};

function describeAnswer(askedValue: TemplateAskedValue) {
  if (askedValue.type === "secret") return "you enter it, sealed";
  return askedValue.default ? `default ${askedValue.default}` : "no default";
}
