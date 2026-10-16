"use client";
import { Label, RadioGroupItem } from "@akashnetwork/ui/components";

interface Props {
  id: string;
  value: string;
  label: string;
  description: string;
}

export function RadioCard({ id, value, label, description }: Props) {
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border p-3 font-normal has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-muted/40"
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5 shrink-0" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs leading-[17px] text-muted-foreground">{description}</span>
      </span>
    </Label>
  );
}
