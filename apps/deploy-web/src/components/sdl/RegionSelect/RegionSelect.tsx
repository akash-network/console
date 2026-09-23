import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { MapPin } from "iconoir-react";

import { SearchableSelect } from "@src/components/shared/SearchableSelect/SearchableSelect";
import { usePlacementOptions } from "@src/queries/usePlacementOptions";
import { useProviderRegions } from "@src/queries/useProvidersQuery";
import type { SdlBuilderFormValuesType } from "@src/types";

export const DEPENDENCIES = { useProviderRegions, usePlacementOptions };

type Props = {
  placementIndex: number;
  /** Disables the trigger while the pane is locked so the region can't be changed. */
  disabled?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const RegionSelect: FC<Props> = ({ placementIndex, disabled, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { data: regions } = d.useProviderRegions();
  const { data: placementOptions } = d.usePlacementOptions();
  const offeredRegions = filterToAvailable(
    (regions ?? []).map(region => region.key),
    placementOptions?.regions
  );

  return (
    <Controller
      control={control}
      name={`placements.${placementIndex}.region`}
      render={({ field }) => (
        <SearchableSelect
          value={field.value ?? ""}
          onChange={field.onChange}
          options={withSelected(offeredRegions, field.value).map(region => ({ value: region, label: region }))}
          ariaLabel="Region"
          searchLabel="Search regions"
          searchPlaceholder="Search regions..."
          notFoundMessage="No regions found."
          emptyOption={{ value: "", label: "Any region" }}
          leadingIcon={<MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          disabled={disabled}
          triggerClassName="h-8 px-3 text-xs"
        />
      )}
    />
  );
};

/** An absent or empty availability answer leaves the catalog untouched, so a failed fetch offers too much rather than nothing. */
function filterToAvailable(regions: string[], availableRegions: string[] | undefined): string[] {
  if (!availableRegions?.length) return regions;
  const available = new Set(availableRegions);
  return regions.filter(region => available.has(region));
}

/** Keeps a region a draft or an imported SDL already pins selectable, even once no online provider offers it. */
function withSelected(regions: string[], selected: string | undefined): string[] {
  if (!selected || regions.includes(selected)) return regions;
  return [...regions, selected];
}
