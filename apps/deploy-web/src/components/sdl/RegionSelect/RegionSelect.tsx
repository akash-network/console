import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { cn } from "@akashnetwork/ui/utils";
import { MapPin } from "iconoir-react";

import { SearchableMultiSelect } from "@src/components/shared/SearchableSelect/SearchableSelect";
import { usePlacementOptions } from "@src/queries/usePlacementOptions";
import { useProviderRegions } from "@src/queries/useProvidersQuery";
import type { SdlBuilderFormValuesType } from "@src/types";
import { formatProviderCount } from "@src/utils/providerUtils";

export const DEPENDENCIES = { useProviderRegions, usePlacementOptions };

type Props = {
  placementIndex: number;
  /** Disables the trigger while the pane is locked so the regions can't be changed. */
  disabled?: boolean;
  triggerClassName?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const RegionSelect: FC<Props> = ({ placementIndex, disabled, triggerClassName, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { data: regions } = d.useProviderRegions();
  const { data: placementOptions } = d.usePlacementOptions();
  const catalogRegions = (regions ?? []).map(region => region.key);

  return (
    <Controller
      control={control}
      name={`placements.${placementIndex}.regions`}
      render={({ field }) => {
        const pickedRegions = field.value ?? [];
        const { offered, unavailable } = splitByAvailability(withPicked(catalogRegions, pickedRegions), placementOptions?.regions);

        return (
          <SearchableMultiSelect
            value={pickedRegions}
            onChange={field.onChange}
            options={offered.map(region => ({ value: region, label: region, hint: formatProviderCount(placementOptions?.regionProviderCounts?.[region]) }))}
            unavailableOptions={unavailable.map(region => ({ value: region, label: region }))}
            ariaLabel="Region"
            searchLabel="Search regions"
            searchPlaceholder="Search regions..."
            notFoundMessage="No regions found."
            emptyOption={{ value: "", label: "Any region" }}
            renderValue={summarizeRegions}
            leadingIcon={<MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            disabled={disabled}
            triggerClassName={cn("h-8 px-3 text-xs", triggerClassName)}
          />
        );
      }}
    />
  );
};

/** The compact trigger truncates, so it names the first region and counts the rest rather than listing them all. */
function summarizeRegions([firstRegion, ...otherRegions]: string[]): string {
  return otherRegions.length > 0 ? `${firstRegion} +${otherRegions.length}` : firstRegion;
}

/** An absent or empty availability answer offers every region, so a failed fetch offers too much rather than nothing. */
function splitByAvailability(regions: string[], availableRegions: string[] | undefined): { offered: string[]; unavailable: string[] } {
  if (!availableRegions?.length) return { offered: regions, unavailable: [] };

  const available = new Set(availableRegions);
  return { offered: regions.filter(region => available.has(region)), unavailable: regions.filter(region => !available.has(region)) };
}

/** Keeps the regions a draft or an imported SDL already picks in the list, even when the catalog does not carry them. */
function withPicked(regions: string[], picked: string[]): string[] {
  return [...regions, ...picked.filter(region => !regions.includes(region))];
}
