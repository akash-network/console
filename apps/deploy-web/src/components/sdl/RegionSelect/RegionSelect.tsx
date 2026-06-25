import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { MapPin } from "iconoir-react";

import { useProviderRegions } from "@src/queries/useProvidersQuery";
import type { SdlBuilderFormValuesType } from "@src/types";

export const DEPENDENCIES = { useProviderRegions };

/** Sentinel item value: radix Select forbids empty-string values, so "no region" needs a marker. */
const ANY_REGION_VALUE = "any";

type Props = {
  placementIndex: number;
  /** Disables the trigger while the pane is locked so the region can't be changed. */
  disabled?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const RegionSelect: FC<Props> = ({ placementIndex, disabled, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { data: regions } = d.useProviderRegions();

  return (
    <Controller
      control={control}
      name={`placements.${placementIndex}.region`}
      render={({ field }) => (
        <Select disabled={disabled} value={field.value || ANY_REGION_VALUE} onValueChange={value => field.onChange(value === ANY_REGION_VALUE ? undefined : value)}>
          <SelectTrigger aria-label="Region" className="h-8 w-full text-xs">
            <div className="flex min-w-0 items-center gap-1.5 truncate">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_REGION_VALUE}>Any region</SelectItem>
            {(regions ?? []).map(region => (
              <SelectItem key={region.key} value={region.key}>
                {region.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
};
