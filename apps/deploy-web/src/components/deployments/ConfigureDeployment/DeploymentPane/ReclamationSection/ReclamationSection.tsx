import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { CustomTooltip, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import type { ReclamationMinWindow, SdlBuilderFormValuesType } from "@src/types";

/**
 * Sentinel value for the selectable "Any" item. Radix forbids empty-string item values, so the
 * "no requirement" choice needs a non-empty marker. It is intentionally distinct from the Select's
 * cleared value (the empty string): keeping them different means "Any" is never the active value, so
 * clicking it always fires `onValueChange` instead of being a no-op on the already-selected item.
 */
export const RECLAMATION_ANY_VALUE = "any";

/**
 * Dropdown options for the reclamation window. Each option carries a friendly `label` and the SDL
 * duration `value` it maps to. "Any" is the default — it means the user has no requirement, so it is
 * represented by the {@link RECLAMATION_ANY_VALUE} sentinel and omitted from the generated SDL.
 */
export const RECLAMATION_WINDOW_OPTIONS: ReadonlyArray<{ label: string; value: ReclamationMinWindow | typeof RECLAMATION_ANY_VALUE }> = [
  { label: "Any", value: RECLAMATION_ANY_VALUE },
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "1 day", value: "24h" },
  { label: "3 days", value: "72h" }
];

type Props = {
  /** While the pane is locked the control is disabled so it can't be edited while quotes are active. */
  locked?: boolean;
};

export const ReclamationSection: FC<Props> = ({ locked = false }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();

  return (
    <fieldset disabled={locked} className="m-0 min-w-0 space-y-2 border-0 p-0">
      <div className="flex items-center gap-2 px-1 font-mono text-xs uppercase text-muted-foreground">
        Reclamation
        <CustomTooltip
          className="max-w-[260px] p-3 font-sans text-xs normal-case text-muted-foreground"
          title={
            <>
              <strong>Minimum Reclamation Window</strong>
              <br />
              <br />
              The minimum notice a provider must give before reclaiming your deployment, giving you time to migrate your workload.
              <br />
              <br />
              Selecting a value narrows the pool of eligible providers — the larger the window, the fewer providers can satisfy it.
              <br />
              <br />
              Choose <strong>Any</strong> if you have no requirement.
            </>
          }
        >
          <InfoCircle className="h-3.5 w-3.5" />
        </CustomTooltip>
      </div>

      <Controller
        control={control}
        name="reclamationMinWindow"
        render={({ field }) => (
          <Select
            disabled={locked}
            value={field.value ?? ""}
            onValueChange={value => field.onChange(value === RECLAMATION_ANY_VALUE ? undefined : (value as ReclamationMinWindow))}
          >
            <SelectTrigger aria-label="Reclamation" className="h-8 w-full text-xs">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RECLAMATION_WINDOW_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
    </fieldset>
  );
};
