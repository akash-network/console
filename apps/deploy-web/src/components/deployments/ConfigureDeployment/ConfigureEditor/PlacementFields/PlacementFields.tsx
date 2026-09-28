import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@akashnetwork/ui/components";

import { RegionSelect } from "@src/components/sdl/RegionSelect/RegionSelect";
import type { SdlBuilderFormValuesType } from "@src/types";

export const DEPENDENCIES = { RegionSelect };

type Props = {
  placementIndex: number;
  serviceCount: number;
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const PlacementFields: FC<Props> = ({ placementIndex, serviceCount, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();

  return (
    <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] items-start gap-4">
        <Controller
          control={control}
          name={`placements.${placementIndex}.name`}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-2">
              <Input
                label="Placement name"
                labelClassName="font-mono text-xs uppercase text-muted-foreground"
                inputClassName="h-9"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                disabled={locked}
              />
              {fieldState.error?.message && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
            </div>
          )}
        />
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase text-muted-foreground">Region</span>
          <d.RegionSelect placementIndex={placementIndex} disabled={locked} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{serviceCount === 1 ? "1 service" : `${serviceCount} services`} in this placement</p>
    </fieldset>
  );
};
