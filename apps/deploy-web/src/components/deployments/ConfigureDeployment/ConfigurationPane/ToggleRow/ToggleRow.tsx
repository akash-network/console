import type { FC } from "react";
import { useId } from "react";
import { Switch } from "@akashnetwork/ui/components";

type Props = {
  label: string;
  description: string;
  /** Accessible name of the switch; it must contain the visible label. */
  switchLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** An opt-in setting inside a card body: its name and what it does on the left, the switch on the right. */
export const ToggleRow: FC<Props> = ({ label, description, switchLabel, checked, onCheckedChange, disabled }) => {
  const switchId = useId();

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={switchId} className="cursor-pointer text-sm font-medium">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={switchId} aria-label={switchLabel} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
};
