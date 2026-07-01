import type { FC } from "react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Button, Command, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@akashnetwork/ui/components";
import { MapPin, NavArrowDown } from "iconoir-react";

import { useProviderRegions } from "@src/queries/useProvidersQuery";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { ApiProviderRegion } from "@src/types/provider";

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredRegions = filterRegions(regions ?? [], search);

  function closeAndResetSearch(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  }

  return (
    <Controller
      control={control}
      name={`placements.${placementIndex}.region`}
      render={({ field }) => (
        <Popover open={open} onOpenChange={closeAndResetSearch}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label="Region"
              disabled={disabled}
              className="h-8 w-full justify-between gap-1.5 px-3 text-xs font-normal"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{field.value || "Any region"}</span>
              </span>
              <NavArrowDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command label="Search regions" shouldFilter={false}>
              <CommandInput value={search} onValueChange={setSearch} placeholder="Search regions..." />
              <CommandList>
                <CommandItem
                  value="any"
                  onSelect={function selectAnyRegion() {
                    field.onChange("");
                    closeAndResetSearch(false);
                  }}
                >
                  Any region
                </CommandItem>
                {filteredRegions.map(region => (
                  <CommandItem
                    key={region.key}
                    value={region.key}
                    onSelect={function selectRegion() {
                      field.onChange(region.key);
                      closeAndResetSearch(false);
                    }}
                  >
                    {region.key}
                  </CommandItem>
                ))}
                {search && filteredRegions.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No regions found.</p>}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    />
  );
};

/** Case-insensitive substring match over each region's visible key only; an empty/whitespace query returns every region. */
export function filterRegions(regions: ApiProviderRegion[], query: string): ApiProviderRegion[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return regions;
  }
  return regions.filter(region => region.key.toLowerCase().includes(normalized));
}
