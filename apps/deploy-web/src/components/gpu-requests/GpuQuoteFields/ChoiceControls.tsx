import type { ReactNode } from "react";
import { RadioGroup, RadioGroupItem, ToggleGroup, ToggleGroupItem } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";

export type Choice<T> = { value: T; label: string; detail?: string };

export type OptionCard<T extends string> = { value: T; label: string; spec?: string; detail?: string };

const SELECTED_RING_CLASSES =
  "data-[state=on]:border-foreground data-[state=on]:bg-background data-[state=on]:ring-1 data-[state=on]:ring-foreground data-[state=on]:hover:bg-background";

const CHIP_CLASSES = cn(
  "h-auto min-h-[34px] gap-[7px] rounded-lg bg-background px-3 py-1 text-[13px] font-medium shadow-sm hover:border-foreground/35 hover:bg-background data-[state=on]:font-semibold",
  SELECTED_RING_CLASSES
);

const TILE_CLASSES = cn(
  "h-auto min-w-0 flex-col items-start justify-start gap-[3px] whitespace-normal rounded-[10px] bg-background px-3 pb-[11px] pt-2.5 text-left shadow-sm hover:border-foreground/35 hover:bg-background",
  SELECTED_RING_CLASSES
);

const OPTION_CARD_CLASSES =
  "flex cursor-pointer items-start gap-3 rounded-[10px] border bg-background px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] hover:border-foreground/35 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-foreground";

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
      className="flex flex-wrap justify-start gap-1.5"
    >
      {choices.map((choice, index) => (
        <ToggleGroupItem key={choice.label} value={String(index)} className={CHIP_CLASSES}>
          {choice.label}
          {choice.detail && <span className="font-mono text-[11.5px] font-normal text-muted-foreground">{choice.detail}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function MultiChoiceChips<T extends string>({
  label,
  choices,
  values,
  selectedIcon: SelectedIcon,
  onChange
}: {
  label: string;
  choices: Choice<T>[];
  values: T[];
  selectedIcon?: LucideIcon;
  onChange: (values: T[]) => void;
}) {
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      aria-label={label}
      value={values}
      onValueChange={next => onChange(choices.map(choice => choice.value).filter(value => next.includes(value)))}
      className="flex flex-wrap justify-start gap-1.5"
    >
      {choices.map(choice => (
        <ToggleGroupItem key={choice.value} value={choice.value} className={CHIP_CLASSES}>
          {SelectedIcon && values.includes(choice.value) && <SelectedIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          {choice.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Like chips, with room for a second line and a badge, for choices that need their consequence spelled out. */
export function ChoiceTiles<T>({
  label,
  choices,
  value,
  onChange
}: {
  label: string;
  choices: (Choice<T> & { badge?: ReactNode; isNumeric?: boolean })[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const selectedIndex = choices.findIndex(choice => choice.value === value);

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={label}
      value={String(selectedIndex)}
      onValueChange={index => index && onChange(choices[Number(index)].value)}
      className="grid grid-cols-[repeat(auto-fill,minmax(min(132px,100%),1fr))] gap-2"
    >
      {choices.map((choice, index) => (
        <ToggleGroupItem key={choice.label} value={String(index)} className={TILE_CLASSES}>
          <span className="flex w-full min-w-0 items-center gap-1.5">
            <span className={cn("whitespace-nowrap font-semibold", choice.isNumeric ? "font-mono text-sm" : "text-[13px]")}>{choice.label}</span>
            {choice.badge}
          </span>
          {choice.detail && <span className="text-[11.5px] font-normal leading-snug text-muted-foreground">{choice.detail}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function OptionCards<T extends string>({ label, options, value, onChange }: { label: string; options: OptionCard<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={next => onChange(next as T)} className="flex flex-col gap-2">
      {options.map(option => (
        <label key={option.value} className={OPTION_CARD_CLASSES}>
          <RadioGroupItem value={option.value} aria-label={option.label} className="mt-0.5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[13.5px] font-semibold leading-[19px]">{option.label}</span>
            {option.detail && <span className="text-[12.5px] leading-snug text-muted-foreground">{option.detail}</span>}
            {option.spec && <span className="mt-0.5 font-mono text-[11.5px] leading-snug text-muted-foreground">{option.spec}</span>}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

export function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="flex flex-wrap items-baseline justify-between gap-2.5">
        <span className="text-[12.5px] font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
