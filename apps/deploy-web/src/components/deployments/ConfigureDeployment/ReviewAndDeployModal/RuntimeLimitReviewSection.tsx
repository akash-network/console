import type { ChangeEvent, FC } from "react";
import { useState } from "react";
import { CustomTooltip, Input, Switch } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { usePricing } from "@src/hooks/usePricing/usePricing";
import { API_BLOCKS_PER_HOUR } from "@src/utils/deploymentUtils";
import type { ReviewRow } from "./useReviewRows";

export const DEPENDENCIES = { usePricing };

/** A limit is granted in increments of at most 48 hours, matching the API; extend from the deployment's settings. */
export const MAX_RUNTIME_LIMIT_HOURS = 48;

/** What the switch fills in, so turning it on shows a concrete limit instead of an empty field that means nothing. */
const DEFAULT_RUNTIME_LIMIT_HOURS = 24;

type Props = {
  /** The requested runtime limit in hours; undefined means no limit (always-on funding). */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** The review modal's priced placements, used to quote what the requested hours will cost. */
  rows: ReviewRow[];
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Optional runtime limit, offered at the last step so the user picks it against the price they just saw.
 * Whether a limit is offered at all is the modal's call, since the same gate decides what gets submitted.
 */
export const RuntimeLimitReviewSection: FC<Props> = ({ value, onChange, rows, dependencies: d = DEPENDENCIES }) => {
  const { udenomToUsd } = d.usePricing();
  const [isLimited, setIsLimited] = useState(value !== undefined);

  const toggleRuntimeLimit = (enabled: boolean) => {
    setIsLimited(enabled);
    onChange(enabled ? DEFAULT_RUNTIME_LIMIT_HOURS : undefined);
  };

  const applyRuntimeLimitInput = (event: ChangeEvent<HTMLInputElement>) => {
    const hours = Math.floor(Number(event.target.value));
    onChange(hours >= 1 ? Math.min(hours, MAX_RUNTIME_LIMIT_HOURS) : undefined);
  };

  const estimatedCostUsd = value ? estimateRuntimeCostUsd(rows, value, udenomToUsd) : null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Runtime limit</span>
          <CustomTooltip
            className="max-w-[280px] p-3 font-sans text-xs normal-case text-muted-foreground"
            title="Closes this deployment automatically after the set number of hours, counted from when it starts. Unused funds are returned to your balance."
          >
            <InfoCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </CustomTooltip>
        </div>
        <Switch checked={isLimited} onCheckedChange={toggleRuntimeLimit} aria-label="Runtime limit" />
      </div>

      {isLimited && (
        <div className="flex items-center justify-between gap-4">
          <Input
            type="number"
            aria-label="Runtime limit in hours"
            min={1}
            max={MAX_RUNTIME_LIMIT_HOURS}
            step={1}
            value={value ?? ""}
            onChange={applyRuntimeLimitInput}
            endIcon={<span className="pr-2 text-xs text-muted-foreground">hours</span>}
            inputClassName="h-9 text-xs"
            className="max-w-[160px]"
          />
          {estimatedCostUsd !== null && (
            <span className="text-xs text-muted-foreground">
              About ${estimatedCostUsd.toFixed(2)} for {value}h
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * What the requested hours cost, from the same per-block prices the modal totals above. Assumes a single
 * denom across placements, as the rest of the modal does: one deployment shares one deposit denom.
 */
function estimateRuntimeCostUsd(rows: ReviewRow[], hours: number, udenomToUsd: (amount: number, denom: string) => number): number | null {
  const priced = rows.filter((row): row is ReviewRow & { price: { amount: string; denom: string } } => !!row.price);
  if (!priced.length) {
    return null;
  }

  const perBlockUdenom = priced.reduce((sum, row) => sum + Number(row.price.amount), 0);

  return udenomToUsd(perBlockUdenom * API_BLOCKS_PER_HOUR * hours, priced[0].price.denom);
}
