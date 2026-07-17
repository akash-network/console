"use client";

import type { ChangeEventHandler } from "react";
import React, { useCallback } from "react";
import { Field, FieldContent, FieldError, FieldLabel, FieldTitle, Input, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";

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
}

export function AddCreditsAmountFields({ value, onChange, minAmount, error, onAmountCommit }: AddCreditsAmountFieldsProps) {
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
          <FieldLabel htmlFor="plus-plan">
            <Field orientation="horizontal" className="cursor-pointer p-2">
              <RadioGroupItem value="100" id="plus-plan" className="self-center" />
              <FieldContent>
                <FieldTitle className="font-medium">100</FieldTitle>
              </FieldContent>
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor="pro-plan">
            <Field orientation="horizontal" className="cursor-pointer p-2">
              <RadioGroupItem value="500" id="pro-plan" className="self-center" />
              <FieldContent>
                <FieldTitle>500</FieldTitle>
              </FieldContent>
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor="enterprise-plan">
            <Field orientation="horizontal" className="cursor-pointer p-2">
              <RadioGroupItem value="1000" id="enterprise-plan" className="self-center" />
              <FieldContent>
                <FieldTitle>1000</FieldTitle>
              </FieldContent>
            </Field>
          </FieldLabel>
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
