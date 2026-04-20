"use client";
import type { FC } from "react";
import { Input, Slider } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { FormPaper } from "../../sdl/FormPaper";

type AuditorOption = {
  label: string;
  address: string;
};

type RegionOption = {
  label: string;
  key: string;
};

export const AUDITOR_OPTIONS: AuditorOption[] = [
  { label: "Akash Network", address: "akash1365ez9ux3wm6cvahl5asp47f3ncqtqsagcsru2" },
  { label: "Overclock Labs", address: "akash10cl5rm0cqnpj45knzakpa4cnvn5amzwp4lhcal" }
];

export const REGION_OPTIONS: RegionOption[] = [
  { label: "N. America", key: "north-america" },
  { label: "Europe", key: "europe" },
  { label: "APAC", key: "apac" }
];

type Props = {
  filters: PlacementFilters;
  onChange: (filters: PlacementFilters) => void;
};

const ChipButton: FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"
    )}
  >
    {children}
  </button>
);

export const PlacementSection: FC<Props> = ({ filters, onChange }) => {
  const handleMaxPriceChange = (values: number[]) => {
    onChange({ ...filters, maxPrice: values[0] });
  };

  const handleMaxPriceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0.01 && value <= 2.0) {
      onChange({ ...filters, maxPrice: value });
    }
  };

  const toggleAuditor = (address: string) => {
    const current = filters.auditedBy;
    const next = current.includes(address) ? current.filter(a => a !== address) : [...current, address];
    onChange({ ...filters, auditedBy: next });
  };

  const toggleRegion = (key: string) => {
    const current = filters.regions;
    const next = current.includes(key) ? current.filter(r => r !== key) : [...current, key];
    onChange({ ...filters, regions: next });
  };

  return (
    <FormPaper>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <strong className="text-sm">Placement</strong>
          {(filters.maxPrice || filters.auditedBy.length > 0 || filters.regions.length > 0) && <span className="h-2 w-2 rounded-full bg-primary" />}
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Max price</label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={filters.maxPrice ?? ""}
              onChange={handleMaxPriceInput}
              placeholder="0.1"
              className="w-20"
              min={0.01}
              max={2.0}
              step={0.01}
            />
            <span className="text-xs text-muted-foreground">ACT / block</span>
          </div>
          <Slider value={[filters.maxPrice ?? 0.1]} onValueChange={handleMaxPriceChange} min={0.01} max={2.0} step={0.01} className="mt-2" />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0.01</span>
            <span>0.5</span>
            <span>1.0</span>
            <span>2.0</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Audited by</label>
          <div className="flex flex-wrap gap-2">
            <ChipButton selected={filters.auditedBy.length === 0} onClick={() => onChange({ ...filters, auditedBy: [] })}>
              Any
            </ChipButton>
            {AUDITOR_OPTIONS.map(opt => (
              <ChipButton key={opt.address} selected={filters.auditedBy.includes(opt.address)} onClick={() => toggleAuditor(opt.address)}>
                {opt.label}
              </ChipButton>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Regions</label>
          <div className="flex flex-wrap gap-2">
            <ChipButton selected={filters.regions.length === 0} onClick={() => onChange({ ...filters, regions: [] })}>
              Any
            </ChipButton>
            {REGION_OPTIONS.map(opt => (
              <ChipButton key={opt.key} selected={filters.regions.includes(opt.key)} onClick={() => toggleRegion(opt.key)}>
                {opt.label}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>
    </FormPaper>
  );
};
