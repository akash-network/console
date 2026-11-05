import type { ReactNode } from "react";
import { RadioGroup, RadioGroupItem, ToggleGroup, ToggleGroupItem } from "@akashnetwork/ui/components";

export type Choice<T> = { value: T; label: string; detail?: string };

export type Option<T extends string> = { value: T; title: string; description: string; detail?: string };

const CHIP_CLASSES =
  "h-auto min-h-9 gap-2 rounded-full px-4 py-1.5 font-normal data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground data-[state=on]:hover:text-background";

/** Toggle items only carry string values, so each choice is keyed by its position and handed back as its own value. */
export function ChoiceChips<T>({ label, choices, value, onChange }: { label: string; choices: Choice<T>[]; value: T | null; onChange: (value: T) => void }) {
  const selectedIndex = choices.findIndex(choice => choice.value === value);

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={label}
      value={selectedIndex === -1 ? "" : String(selectedIndex)}
      onValueChange={index => index && onChange(choices[Number(index)].value)}
      className="flex flex-wrap justify-start gap-2"
    >
      {choices.map((choice, index) => (
        <ToggleGroupItem key={choice.label} value={String(index)} className={CHIP_CLASSES}>
          {choice.label}
          {choice.detail && <span className="font-mono text-xs opacity-70">{choice.detail}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function MultiChoiceChips<T extends string>({
  label,
  choices,
  values,
  onChange
}: {
  label: string;
  choices: Choice<T>[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      aria-label={label}
      value={values}
      onValueChange={next => onChange(choices.map(choice => choice.value).filter(value => next.includes(value)))}
      className="flex flex-wrap justify-start gap-2"
    >
      {choices.map(choice => (
        <ToggleGroupItem key={choice.value} value={choice.value} className={CHIP_CLASSES}>
          {choice.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function OptionCards<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <RadioGroup aria-label={label} value={value ?? ""} onValueChange={next => onChange(next as T)} className="gap-2">
      {options.map(option => (
        <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-foreground">
          <RadioGroupItem value={option.value} className="mt-0.5" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">{option.title}</span>
            <span className="text-sm text-muted-foreground">{option.description}</span>
            {option.detail && <span className="font-mono text-xs text-muted-foreground">{option.detail}</span>}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

export function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
