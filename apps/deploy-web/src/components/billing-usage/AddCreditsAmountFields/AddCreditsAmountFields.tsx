"use client";

import type { ChangeEventHandler } from "react";
import React, { useCallback } from "react";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle, Input, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";

import { deploymentRunwayOf, PRESET_AMOUNTS_USD } from "./presetAmounts";

export interface AddCreditsAmountValue {
  predefinedAmount?: string;
  customAmount: string;
}

interface AddCreditsAmountFieldsProps {
  value: AddCreditsAmountValue;
  onChange: (value: AddCreditsAmountValue) => void;
  minAmount: number;
  error?: string;
  /** Fired when the user commits an amount — a preset pick or a blurred custom amount — for analytics. */
  onAmountCommit?: (amount: number, isCustom: boolean) => void;
  deploymentDailyCostUsd?: number;
}

export function AddCreditsAmountFields({ value, onChange, minAmount, error, onAmountCommit, deploymentDailyCostUsd }: AddCreditsAmountFieldsProps) {
  const changePredefinedAmount = useCallback(
    (predefinedAmount: string) => {
      onChange({ predefinedAmount, customAmount: "" });
      onAmountCommit?.(Number(predefinedAmount), false);
    },
    [onChange, onAmountCommit]
  );

  const changeCustomAmount: ChangeEventHandler<HTMLInputElement> = useCallback(
    e => {
      onChange({ customAmount: e.target.value, predefinedAmount: "" });
    },
    [onChange]
  );

  const commitCustomAmount = useCallback(() => {
    const amount = Number(value.customAmount);
    if (amount > 0) {
      onAmountCommit?.(amount, true);
    }
  }, [value.customAmount, onAmountCommit]);

  return (
    <div className="space-y-3">
      <h3 className="text-left text-sm font-medium text-muted-foreground">Credit amount</h3>

      <div className="space-y-1">
        <h3 className="text-sm font-medium leading-snug">Choose your amount</h3>
        <RadioGroup value={value.predefinedAmount} className="grid-cols-3" onValueChange={changePredefinedAmount}>
          {PRESET_AMOUNTS_USD.map(amountUsd => (
            <FieldLabel key={amountUsd} htmlFor={`preset-amount-${amountUsd}`}>
              <Field orientation="horizontal" className="cursor-pointer p-2">
                <RadioGroupItem value={String(amountUsd)} id={`preset-amount-${amountUsd}`} className="self-center" />
                <FieldContent>
                  <FieldTitle>{amountUsd}</FieldTitle>
                  {!!deploymentDailyCostUsd && <FieldDescription className="text-xs">{deploymentRunwayOf(amountUsd, deploymentDailyCostUsd)}</FieldDescription>}
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </div>

      <Field className="gap-1">
        <FieldLabel htmlFor="custom-amount" className="font-medium">
          Or enter custom amount <span className="text-muted-foreground">(minimum {minAmount})</span>
        </FieldLabel>
        <Input
          id="custom-amount"
          aria-label="custom-amount"
          inputClassName="h-9"
          type="number"
          value={value.customAmount}
          onChange={changeCustomAmount}
          onBlur={commitCustomAmount}
          min={minAmount}
          step="0.01"
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </div>
  );
}
