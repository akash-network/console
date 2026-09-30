import type { FC, ReactNode } from "react";
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
  children?: ReactNode;
};

/** An opt-in setting inside a card body: its name and switch on top, and the settings it unlocks grouped below in the same container. */
export const ToggleRow: FC<Props> = ({ label, description, switchLabel, checked, onCheckedChange, disabled, children }) => {
  const switchId = useId();

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={switchId} className="cursor-pointer text-sm font-medium">
            {label}
          </label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch id={switchId} aria-label={switchLabel} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-4 border-t border-zinc-200 p-4 empty:hidden dark:border-zinc-800">{children}</div>
    </div>
  );
};
