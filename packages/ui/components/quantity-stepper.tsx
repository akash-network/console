"use client";
import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "../utils";
import { Button } from "./button";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Accessible name for the value, e.g. "GPU count". */
  label: string;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * Compact "− / value / +" selector for small integer quantities (e.g. GPU count,
 * replicas). Three segments share a single rounded outline; the buttons clamp
 * to `min`/`max` and disable at the bounds. The middle segment is an editable
 * number input: typing clamps to `max` immediately (you can't enter more than
 * allowed) but defers `min`/empty correction to blur so the field can be cleared
 * and retyped freely. Purely controlled — callers own the value (typically wired
 * to a react-hook-form field via a Controller).
 */
const QuantityStepper = React.forwardRef<HTMLInputElement, QuantityStepperProps>(
  ({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, disabled, label, className, "aria-describedby": ariaDescribedBy }, ref) => {
    const clamp = (next: number) => Math.min(max, Math.max(min, next));
    const decrement = () => onChange(clamp(value - step));
    const increment = () => onChange(clamp(value + step));

    // Local draft lets the user clear the field or type a partial number without
    // the controlled value snapping back on every keystroke.
    const [draft, setDraft] = React.useState<string | null>(null);
    const displayValue = draft ?? String(value);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw === "") {
        setDraft("");
        return;
      }

      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) return;

      // Clamp the upper bound while typing so an over-max value is impossible,
      // but let values below `min` stand until blur so the field stays editable.
      const next = Math.min(max, parsed);
      setDraft(String(next));
      if (next !== value) onChange(next);
    };

    const commit = () => {
      if (draft === null) return;
      const next = draft === "" ? clamp(min) : clamp(Number(draft));
      if (next !== value) onChange(next);
      setDraft(null);
    };

    return (
      <div className={cn("border-input inline-flex h-9 items-stretch overflow-hidden rounded-md border shadow-sm", className)}>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Decrease ${label}`}
          onClick={decrement}
          disabled={disabled || value <= min}
          className="text-foreground h-full w-9 rounded-none p-0"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <input
          ref={ref}
          type="number"
          inputMode="numeric"
          aria-label={label}
          aria-describedby={ariaDescribedBy}
          value={displayValue}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={handleChange}
          onBlur={commit}
          className={cn(
            "border-input text-foreground w-12 border-x bg-transparent px-1 text-center text-sm tabular-nums",
            "focus-visible:ring-ring focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          )}
        />
        <Button
          type="button"
          variant="ghost"
          aria-label={`Increase ${label}`}
          onClick={increment}
          disabled={disabled || value >= max}
          className="text-foreground h-full w-9 rounded-none p-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);
QuantityStepper.displayName = "QuantityStepper";

export { QuantityStepper };
