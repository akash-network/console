"use client";
import type { ChangeEvent, FC } from "react";
import { useMemo, useState } from "react";
import type { ActionButton } from "@akashnetwork/ui/components";
import { Input, Popup } from "@akashnetwork/ui/components";

import { usePricing } from "@src/hooks/usePricing/usePricing";
import { API_BLOCKS_PER_HOUR } from "@src/utils/deploymentUtils";
import { MAX_RUNTIME_LIMIT_HOURS, MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/utils/runtimeLimitUtils";

export const DEPENDENCIES = { usePricing };

export interface AddRuntimeHoursModalProps {
  currentLimitHours: number;
  costPerBlockUdenom: number;
  denom: string;
  onSubmit: (totalHours: number) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

const DEFAULT_ADDED_HOURS = 12;

/**
 * Buys more runtime for a limited deployment. The user picks how many hours to add, but the request
 * carries the new total, because the API only accepts absolute limits: a retried or duplicated request
 * then lands on the same total instead of extending twice.
 */
export const AddRuntimeHoursModal: FC<AddRuntimeHoursModalProps> = ({
  currentLimitHours,
  costPerBlockUdenom,
  denom,
  onSubmit,
  onCancel,
  isSubmitting = false,
  dependencies: d = DEPENDENCIES
}) => {
  const { udenomToUsd } = d.usePricing();
  const maxAddedHours = Math.min(MAX_RUNTIME_LIMIT_INCREMENT_HOURS, MAX_RUNTIME_LIMIT_HOURS - currentLimitHours);
  const [addedHours, setAddedHours] = useState(Math.min(DEFAULT_ADDED_HOURS, maxAddedHours));

  const applyAddedHoursInput = (event: ChangeEvent<HTMLInputElement>) => {
    const hours = Math.floor(Number(event.target.value));
    setAddedHours(Math.max(0, Math.min(hours, maxAddedHours)));
  };

  const estimatedCostUsd = udenomToUsd(costPerBlockUdenom * API_BLOCKS_PER_HOUR * addedHours, denom);

  const actions = useMemo(
    () =>
      [
        { label: "Cancel", color: "primary", variant: "outline", side: "right", onClick: onCancel },
        {
          label: "Add hours",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: addedHours < 1 || isSubmitting,
          onClick: () => onSubmit(currentLimitHours + addedHours)
        }
      ] as ActionButton[],
    [addedHours, currentLimitHours, isSubmitting, onCancel, onSubmit]
  );

  return (
    <Popup fullWidth open variant="custom" actions={actions} onClose={onCancel} enableCloseOnBackdropClick title="Add runtime hours">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This deployment closes automatically after {currentLimitHours}h. Add up to {maxAddedHours} more hours now, and add more again later.
        </p>

        <Input
          type="number"
          aria-label="Hours to add"
          min={1}
          max={maxAddedHours}
          step={1}
          value={addedHours}
          onChange={applyAddedHoursInput}
          endIcon={<span className="pr-2 text-xs text-muted-foreground">hours</span>}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">New limit</span>
          <span className="font-medium">{currentLimitHours + addedHours}h</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated cost</span>
          <span className="font-medium">${estimatedCostUsd.toFixed(2)}</span>
        </div>
      </div>
    </Popup>
  );
};
