"use client";
import type { FC, ReactNode } from "react";
import { MdStorage } from "react-icons/md";
import { Input } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { averageBlockTime, getAvgCostPerMonth } from "@src/utils/priceUtils";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { AUDITOR_OPTIONS, REGION_OPTIONS } from "../PlacementSection";
import { CollapsibleCard } from "./CollapsibleCard";

const ACT_USD_PRICE = 0.35;

const formatUsd = (value: number): string => {
  if (value >= 100) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(3)}`;
};

const ChipPill: FC<{ selected: boolean; onClick: () => void; children: ReactNode }> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
      selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
    )}
  >
    {children}
  </button>
);

type Props = {
  placementFilters: PlacementFilters;
  onPlacementChange: (filters: PlacementFilters) => void;
};

export const PlacementCard: FC<Props> = ({ placementFilters, onPlacementChange }) => {
  const placementActive = (placementFilters.maxPrice ?? 0) > 0 || placementFilters.auditedBy.length > 0 || placementFilters.regions.length > 0;

  const maxPrice = placementFilters.maxPrice ?? 0;
  const perHourUsd = ((maxPrice * 3600) / averageBlockTime) * ACT_USD_PRICE;
  const perMonthUsd = getAvgCostPerMonth(maxPrice) * ACT_USD_PRICE;

  const summary = placementActive
    ? [
        placementFilters.maxPrice ? `≤${placementFilters.maxPrice} ACT` : "",
        placementFilters.auditedBy.length > 0 ? "Audited" : "",
        placementFilters.regions.length > 0 ? `${placementFilters.regions.length} region${placementFilters.regions.length > 1 ? "s" : ""}` : ""
      ]
        .filter(Boolean)
        .join(" · ")
    : "Any";

  return (
    <CollapsibleCard
      icon={<MdStorage className="h-3.5 w-3.5" />}
      title="Placement"
      summary={summary}
      hasChanges={placementActive}
      onReset={() => onPlacementChange({ maxPrice: 0.1, auditedBy: [], regions: [] })}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Max price</label>
          <p className="mb-2 text-[11px] text-muted-foreground/70">Exclude providers that charge more than this per block.</p>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={placementFilters.maxPrice ?? ""}
              onChange={e => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0.01 && value <= 2.0) {
                  onPlacementChange({ ...placementFilters, maxPrice: value });
                }
              }}
              placeholder="0.1"
              inputClassName="h-8 w-[80px]"
              min={0.01}
              max={2.0}
              step={0.01}
            />
            <span className="rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground">ACT / block</span>
          </div>
          {maxPrice > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              ≈ {formatUsd(perHourUsd)} / hour · {formatUsd(perMonthUsd)} / month
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Audited by</label>
          <div className="flex flex-wrap gap-2">
            <ChipPill selected={placementFilters.auditedBy.length === 0} onClick={() => onPlacementChange({ ...placementFilters, auditedBy: [] })}>
              Any
            </ChipPill>
            {AUDITOR_OPTIONS.map(opt => (
              <ChipPill
                key={opt.address}
                selected={placementFilters.auditedBy.includes(opt.address)}
                onClick={() => {
                  const current = placementFilters.auditedBy;
                  const next = current.includes(opt.address) ? current.filter(a => a !== opt.address) : [...current, opt.address];
                  onPlacementChange({ ...placementFilters, auditedBy: next });
                }}
              >
                {opt.label}
              </ChipPill>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-muted-foreground">Regions</label>
          <div className="flex flex-wrap gap-2">
            <ChipPill selected={placementFilters.regions.length === 0} onClick={() => onPlacementChange({ ...placementFilters, regions: [] })}>
              Any
            </ChipPill>
            {REGION_OPTIONS.map(opt => (
              <ChipPill
                key={opt.key}
                selected={placementFilters.regions.includes(opt.key)}
                onClick={() => {
                  const current = placementFilters.regions;
                  const next = current.includes(opt.key) ? current.filter(r => r !== opt.key) : [...current, opt.key];
                  onPlacementChange({ ...placementFilters, regions: next });
                }}
              >
                {opt.label}
              </ChipPill>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
};
