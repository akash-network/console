import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { MapPin } from "iconoir-react";

import { SearchableSelect } from "@src/components/shared/SearchableSelect/SearchableSelect";
import { useProviderRegions } from "@src/queries/useProvidersQuery";
import type { SdlBuilderFormValuesType } from "@src/types";

export const DEPENDENCIES = { useProviderRegions };

type Props = {
  placementIndex: number;
  /** Disables the trigger while the pane is locked so the region can't be changed. */
  disabled?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const RegionSelect: FC<Props> = ({ placementIndex, disabled, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { data: regions } = d.useProviderRegions();
  const options = (regions ?? []).map(region => ({ value: region.key, label: region.key }));

  return (
    <Controller
      control={control}
      name={`placements.${placementIndex}.region`}
      render={({ field }) => (
        <SearchableSelect
          value={field.value ?? ""}
          onChange={field.onChange}
          options={options}
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
