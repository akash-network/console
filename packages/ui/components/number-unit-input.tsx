"use client";
import * as React from "react";
import { useCallback, useId } from "react";

import { cn } from "../utils";
import { FieldError } from "./field";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export interface NumberUnitOption {
  suffix: string;
}

export interface NumberUnitInputProps {
  label: string;
  value: number | undefined;
  unit: string;
  units: NumberUnitOption[];
  onValueChange: (value: number | undefined) => void;
  onUnitChange: (unit: string) => void;
  /** Fires when the numeric half loses focus — bind to a form field's `onBlur` so `onTouched` validation runs. */
  onBlur?: () => void;
  min?: number;
  step?: number;
  placeholder?: string;
  error?: string;
  errorClassName?: string;
  /** Greys out and blocks both halves — e.g. when previewing default values the consumer can't yet edit. */
  disabled?: boolean;
}

/**
 * A number input fused with a unit select into a single visual control: the
 * input keeps only its left corners rounded and the unit trigger only its
 * right corners, so the pair reads as one field (e.g. Memory, Storage). Each
 * half is controlled independently so callers can bind them to separate form
 * fields (e.g. `ram` + `ramUnit`). The native number spinners are hidden so the
 * value isn't clipped, and the focused half raises above the shared border so
 * its focus ring isn't hidden behind the neighbouring control.
 */
const NumberUnitInput = React.forwardRef<HTMLInputElement, NumberUnitInputProps>(
  ({ label, value, unit, units, onValueChange, onUnitChange, onBlur, min = 1, step = 1, placeholder, error, errorClassName, disabled = false }, ref) => {
    const errorId = useId();
    const hasError = !!error;

    const updateValue = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = parseFloat(event.target.value);
        onValueChange(Number.isFinite(next) ? next : undefined);
      },
      [onValueChange]
    );

    return (
      <div className="flex w-full flex-col gap-1">
        <div className="flex w-full items-stretch">
          <Input
            ref={ref}
            type="number"
            aria-label={label}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            value={Number.isFinite(value) ? value : ""}
            min={min}
            step={step}
            placeholder={placeholder}
            error={hasError}
            disabled={disabled}
            onChange={updateValue}
            onBlur={onBlur}
            className="min-w-0 flex-1 space-y-0"
            inputClassName="h-9 rounded-r-none focus-visible:relative focus-visible:z-10"
          />
          <Select value={unit} onValueChange={onUnitChange} disabled={disabled}>
            <SelectTrigger
              aria-label={`${label} unit`}
              className={cn("h-9 w-auto shrink-0 gap-2 rounded-l-none border-l-0 px-2 focus:relative focus:z-10", {
                "ring-destructive ring-2 ring-offset-1": hasError
              })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map(option => (
                <SelectItem key={option.suffix} value={option.suffix}>
                  {option.suffix}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasError && (
          <FieldError id={errorId} className={errorClassName}>
            {error}
          </FieldError>
        )}
      </div>
    );
  }
);
NumberUnitInput.displayName = "NumberUnitInput";

export { NumberUnitInput };
