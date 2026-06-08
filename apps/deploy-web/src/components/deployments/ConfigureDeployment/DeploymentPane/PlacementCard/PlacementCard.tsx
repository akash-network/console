import type { FC } from "react";
import { InlineEditInput } from "@akashnetwork/ui/components";
import { Plus, Trash } from "iconoir-react";

import { RegionSelect } from "@src/components/sdl/RegionSelect/RegionSelect";
import type { PlacementType } from "@src/types";
import { ServiceRow } from "../ServiceRow/ServiceRow";
import type { IndexedService } from "../usePlacementManager/usePlacementManager";

export const DEPENDENCIES = { InlineEditInput, RegionSelect, ServiceRow };

type Props = {
  placement: PlacementType;
  placementIndex: number;
  services: IndexedService[];
  selectedServiceId: string | null;
  canRemove: boolean;
  canRemoveService: boolean;
  onSelectService: (serviceId: string) => void;
  onAddService: () => void;
  onRemoveService: (serviceId: string) => void;
  onRemove: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const PlacementCard: FC<Props> = ({
  placement,
  placementIndex,
  services,
  selectedServiceId,
  canRemove,
  canRemoveService,
  onSelectService,
  onAddService,
  onRemoveService,
  onRemove,
  dependencies: d = DEPENDENCIES
}) => {
  return (
    <div className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-700">
      <div className="flex items-center gap-2 px-1 pb-2">
        <d.InlineEditInput name={`placements.${placementIndex}.name`} label="Placement name" />
        {canRemove && (
          <button type="button" aria-label="Remove placement" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-foreground">
            <Trash className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <d.RegionSelect placementIndex={placementIndex} />
      <ul aria-label={`${placement.name} services`} className="mt-2 space-y-2">
        {services.map(({ service, index }) => (
          <d.ServiceRow
            key={service.id}
            service={service}
            serviceIndex={index}
            isSelected={service.id === selectedServiceId}
            canRemove={canRemoveService}
            onSelect={() => onSelectService(service.id as string)}
            onRemove={() => onRemoveService(service.id as string)}
          />
        ))}
      </ul>
      <button
        type="button"
        aria-label="Add service"
        onClick={onAddService}
        className="mt-2 flex w-full items-center justify-center rounded-md py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};
