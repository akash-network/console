import type { FC } from "react";
import { useState } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle, Plus, SidebarCollapse, SidebarExpand } from "iconoir-react";

import { PlacementCard } from "./PlacementCard/PlacementCard";
import { usePlacementManager } from "./usePlacementManager/usePlacementManager";

export const DEPENDENCIES = { PlacementCard, usePlacementManager };

type Props = {
  selectedServiceId: string | null;
  onSelectService: (serviceId: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentPane: FC<Props> = ({ selectedServiceId, onSelectService, dependencies: d = DEPENDENCIES }) => {
  const [minimized, setMinimized] = useState(false);
  const manager = d.usePlacementManager();
  const toggle = () => setMinimized(prev => !prev);

  if (minimized) {
    return (
      <aside aria-label="Deployment pane (minimized)" className="hidden h-full min-h-0 md:flex md:w-[48px] md:flex-col md:items-center md:pt-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Show deployment pane"
          className="flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-accent"
        >
          <SidebarExpand className="h-5 w-5" />
        </button>
      </aside>
    );
  }

  return (
    <section aria-labelledby="configure-deployment-pane-heading" className="flex h-full min-h-0 flex-col md:w-[231px]">
      <header className="hidden h-[52px] shrink-0 items-center justify-between gap-2 border-b border-zinc-300 px-4 md:flex dark:border-zinc-700">
        <h2 id="configure-deployment-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
          1. Deployment
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-label="Hide deployment pane"
          className="flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-accent"
        >
          <SidebarCollapse className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <div className="flex items-center gap-1 px-1 font-mono text-xs uppercase text-muted-foreground">
          Placement
          <CustomTooltip
            className="max-w-[260px] p-3 font-sans text-xs normal-case text-muted-foreground"
            title="A placement sets a region and bundles services that should share a provider. Each placement is deployed together to one provider."
          >
            <InfoCircle className="h-3.5 w-3.5" />
          </CustomTooltip>
        </div>
        {manager.placements.map((placement, index) => (
          <d.PlacementCard
            key={placement.id}
            placement={placement}
            placementIndex={index}
            services={manager.getPlacementServices(placement.id)}
            selectedServiceId={selectedServiceId}
            canRemove={manager.canRemovePlacement}
            canRemoveService={manager.canRemoveService}
            onSelectService={onSelectService}
            onAddService={() => onSelectService(manager.addService(placement.id))}
            onRemoveService={manager.removeService}
            onRemove={() => manager.removePlacement(placement.id)}
          />
        ))}
        <button
          type="button"
          onClick={manager.addPlacement}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-foreground hover:bg-accent dark:border-zinc-700"
        >
          <Plus className="h-4 w-4" />
          Add Placement
        </button>
      </div>
    </section>
  );
};
