"use client";
import type { RangeKey } from "@/lib/series/series";
import { RANGES } from "@/lib/series/series";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full gap-0.5 self-start overflow-x-auto rounded-md border bg-nested p-0.5">
      {options.map(option => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "whitespace-nowrap rounded px-[11px] py-1.5 text-xs font-medium leading-none transition-colors",
              isSelected ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (value: RangeKey) => void }) {
  return (
    <div role="group" aria-label="Time range" className="flex gap-1">
      {RANGES.map(({ key }) => {
        const isSelected = key === value;

        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(key)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 font-mono text-[11px] font-medium leading-none tracking-[0.04em] transition-colors",
              isSelected ? "border-border-strong bg-muted text-foreground" : "text-faint hover:text-foreground"
            )}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
