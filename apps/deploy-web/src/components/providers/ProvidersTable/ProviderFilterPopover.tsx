"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Check, Filter, Search } from "lucide-react";

import type { FilterOption } from "@src/components/providers/ProvidersExplorer/useProvidersExplorerModel";
import { formatGpuModel } from "@src/components/providers/providerSummary/providerSummary";
import { formatRegionLabel, getRegionTone, REGION_DOT_CLASSES } from "@src/components/providers/RegionPill/RegionPill";

type TriggerVariant = "header" | "toolbar";

type RegionFilterPopoverProps = {
  options: FilterOption[];
  selected: string[];
  onChange: (regions: string[]) => void;
  variant: TriggerVariant;
};

export const RegionFilterPopover: FC<RegionFilterPopoverProps> = ({ options, selected, onChange, variant }) => {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const shownOptions = options.filter(
    option => option.value.toLowerCase().includes(normalizedQuery) || formatRegionLabel(option.value).toLowerCase().includes(normalizedQuery)
  );

  return (
    <FilterPopover label="Region" activeCount={selected.length} variant={variant}>
      <label className="mb-1 flex h-7 items-center gap-1.5 rounded-lg border bg-background px-2">
        <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search regions…"
          aria-label="Search regions"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="flex max-h-56 flex-col overflow-y-auto">
        {shownOptions.length === 0 && <span className="px-2 py-2.5 text-[11.5px] text-muted-foreground">No regions match.</span>}
        {shownOptions.map(option => (
          <CheckRow
            key={option.value}
            isChecked={selected.includes(option.value)}
            onToggle={() => onChange(toggle(selected, option.value))}
            dotClassName={REGION_DOT_CLASSES[getRegionTone(option.value)]}
            count={option.count}
          >
            {formatRegionLabel(option.value)}
          </CheckRow>
        ))}
      </div>
      {selected.length > 0 && <PopoverFooter count={selected.length} noun="region" onClear={() => onChange([])} />}
    </FilterPopover>
  );
};

type GpuFilterPopoverProps = {
  options: FilterOption[];
  selected: string[];
  isGpuOnly: boolean;
  onChange: (change: { gpuModels?: string[]; isGpuOnly?: boolean }) => void;
  variant: TriggerVariant;
};

export const GpuFilterPopover: FC<GpuFilterPopoverProps> = ({ options, selected, isGpuOnly, onChange, variant }) => {
  const activeCount = selected.length + (isGpuOnly ? 1 : 0);

  return (
    <FilterPopover label="GPU" activeCount={activeCount} variant={variant}>
      <CheckRow isChecked={isGpuOnly} onToggle={() => onChange({ isGpuOnly: !isGpuOnly })}>
        GPU providers only
      </CheckRow>
      <div className="mx-0.5 my-1 h-px bg-border" />
      <span className="block px-2 pb-0.5 pt-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Model</span>
      <div className="flex max-h-52 flex-col overflow-y-auto">
        {options.length === 0 && <span className="px-2 py-2.5 text-[11.5px] text-muted-foreground">No GPU models on the network right now.</span>}
        {options.map(option => (
          <CheckRow
            key={option.value}
            isChecked={selected.includes(option.value)}
            onToggle={() => onChange({ gpuModels: toggle(selected, option.value) })}
            count={option.count}
          >
            {formatGpuModel(option.value)}
          </CheckRow>
        ))}
      </div>
      {activeCount > 0 && <PopoverFooter count={activeCount} noun="filter" onClear={() => onChange({ gpuModels: [], isGpuOnly: false })} />}
    </FilterPopover>
  );
};

type FilterPopoverProps = {
  label: string;
  activeCount: number;
  variant: TriggerVariant;
  children: ReactNode;
};

const FilterPopover: FC<FilterPopoverProps> = ({ label, activeCount, variant, children }) => (
  <Popover>
    <PopoverTrigger
      aria-label={activeCount > 0 ? `Filter by ${label.toLowerCase()}, ${activeCount} selected` : `Filter by ${label.toLowerCase()}`}
      data-active={activeCount > 0}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap font-mono uppercase transition-colors data-[active=true]:text-foreground",
        variant === "header"
          ? "rounded-md px-1.5 py-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground data-[active=true]:bg-foreground/[0.08] hover:text-foreground"
          : "h-[30px] rounded-lg border bg-card px-2.5 text-[11px] font-medium tracking-[0.06em] text-muted-foreground data-[active=true]:border-foreground/40 hover:bg-muted"
      )}
    >
      {label}
      <Filter className="h-2.5 w-2.5" aria-hidden />
      {activeCount > 0 && (
        <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-[3px] text-[9px] font-semibold tracking-normal text-background">
          {activeCount}
        </span>
      )}
    </PopoverTrigger>
    <PopoverContent align="start" className="w-60 rounded-xl p-1.5 shadow-lg">
      {children}
    </PopoverContent>
  </Popover>
);

type CheckRowProps = {
  isChecked: boolean;
  onToggle: () => void;
  dotClassName?: string;
  count?: number;
  children: ReactNode;
};

const CheckRow: FC<CheckRowProps> = ({ isChecked, onToggle, dotClassName, count, children }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={isChecked}
    onClick={onToggle}
    className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
  >
    <span
      className={cn(
        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
        isChecked ? "border-foreground bg-foreground text-background" : "border-border bg-background"
      )}
      aria-hidden
    >
      {isChecked && <Check className="h-2.5 w-2.5" />}
    </span>
    {dotClassName && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClassName)} aria-hidden />}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {count !== undefined && <span className="font-mono text-[10.5px] text-muted-foreground">{count}</span>}
  </button>
);

const PopoverFooter: FC<{ count: number; noun: string; onClear: () => void }> = ({ count, noun, onClear }) => (
  <div className="mt-1 flex items-center justify-between gap-2 border-t px-2 pb-0.5 pt-1.5">
    <span className="text-[10.5px] text-muted-foreground">
      {count} {noun}
      {count === 1 ? "" : "s"} selected
    </span>
    <button type="button" onClick={onClear} className="text-[11px] font-medium text-foreground underline underline-offset-2">
      Clear
    </button>
  </div>
);

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}
