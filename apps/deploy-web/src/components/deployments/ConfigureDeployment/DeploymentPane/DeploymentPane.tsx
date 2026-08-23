import type { FC } from "react";
import { useState } from "react";
import { Button, CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle, Plus, SidebarCollapse, SidebarExpand } from "iconoir-react";

import { usePlacementsWithBids } from "@src/queries/usePlacementsWithBids";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";
import { DeploymentNameField } from "./DeploymentNameField/DeploymentNameField";
import { PlacementCard } from "./PlacementCard/PlacementCard";
import type { PlacementSelectionState } from "./PlacementSelectionBadge/PlacementSelectionBadge";
import { ReclamationSection } from "./ReclamationSection/ReclamationSection";
import { usePlacementManager } from "./usePlacementManager/usePlacementManager";

export const DEPENDENCIES = { PlacementCard, usePlacementManager, usePlacementsWithBids, ReclamationSection, DeploymentNameField };

type Props = {
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  /** While quotes are active the pane is locked: placements/services stay selectable, but SDL-mutating controls are disabled. The lock banner itself is rendered once across both spec panes by the parent. */
  locked?: boolean;
  phase: DeploymentFlowPhase;
  selections: Record<string, string>;
  selectedPlacementId: string;
  sdl: string;
  dseq: string | null;
  deploymentName: string;
  onDeploymentNameChange: (value: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentPane: FC<Props> = ({
  selectedServiceId,
  onSelectService,
  locked = false,
  phase,
  selections,
  selectedPlacementId,
  sdl,
  dseq,
  deploymentName,
  onDeploymentNameChange,
  dependencies: d = DEPENDENCIES
}) => {
  const [minimized, setMinimized] = useState(false);
  const manager = d.usePlacementManager({ onSelectService });
  const placementsWithBids = d.usePlacementsWithBids({ enabled: phase === "quoting", dseq, sdl, placements: manager.placements });
  const toggle = () => setMinimized(prev => !prev);

  if (minimized) {
    return (
      <aside aria-label="Deployment pane (minimized)" className="col-start-1 row-start-1 row-end-4 flex h-full min-h-0 w-[48px] flex-col items-center pt-2">
        <Button type="button" variant="ghost" onClick={toggle} aria-label="Show deployment pane" className="h-8 w-8 rounded p-0 text-foreground">
          <SidebarExpand className="h-5 w-5" />
        </Button>
      </aside>
    );
  }

  return (
    <section aria-labelledby="configure-deployment-pane-heading" className="col-start-1 row-start-1 row-end-4 grid h-full min-h-0 w-[231px] grid-rows-subgrid">
      <header className="flex h-[52px] items-center justify-between gap-2 border-b border-zinc-300 px-4 dark:border-zinc-700">
        <h2 id="configure-deployment-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
          1. Deployment
        </h2>
        <Button type="button" variant="ghost" onClick={toggle} aria-label="Hide deployment pane" className="h-8 w-8 rounded p-0 text-foreground">
          <SidebarCollapse className="h-5 w-5" />
        </Button>
      </header>
      <div className="row-start-3 min-h-0 space-y-6 overflow-y-auto p-4">
        <d.DeploymentNameField value={deploymentName} onChange={onDeploymentNameChange} disabled={locked} />
        <d.ReclamationSection locked={locked} />
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 font-mono text-xs uppercase text-muted-foreground">
            Placement
            <CustomTooltip
              className="max-w-[260px] p-3 font-sans text-xs normal-case text-muted-foreground"
              title="A placement sets a region and bundles services that should share a provider. Each placement is deployed together to one provider."
            >
              <InfoCircle className="h-3.5 w-3.5" />
            </CustomTooltip>
          </div>
          <div className="space-y-4">
            {manager.placements.map((placement, index) => (
              <d.PlacementCard
                key={placement.id}
                placement={placement}
                placementIndex={index}
                services={manager.getPlacementServices(placement.id)}
                selectedServiceId={selectedServiceId}
                canRemove={manager.canRemovePlacement && !locked}
                canRemoveService={manager.canRemoveService && !locked}
                locked={locked}
                selectionState={placementSelectionState({
                  phase,
                  placementId: placement.id as string,
                  selectedPlacementId,
                  selections,
                  hasBids: placementsWithBids.has(placement.id as string)
                })}
                onSelectService={onSelectService}
                onAddService={() => onSelectService(manager.addService(placement.id))}
                onRemoveService={manager.removeService}
                onRemove={() => manager.removePlacement(placement.id)}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              disabled={locked}
              onClick={() => onSelectService(manager.addPlacement())}
              className="w-full gap-1.5 rounded-lg border border-zinc-300 py-2 text-foreground dark:border-zinc-700"
            >
              <Plus className="h-4 w-4" />
              Add Placement
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

/**
 * Derives the selection badge state for a single placement chip. Badges run from the moment quotes are
 * requested through deploy (creating/quoting/deploying) — to the user, "creating" is already a waiting-for-
 * quotes state, so there's no badge-less gap after Request quotes: WAITING until the placement's bids arrive,
 * SELECTING when it's the focused placement with its bids in, DONE once a provider is chosen. Idle otherwise
 * (configuring, closing, error).
 */
export function placementSelectionState(args: {
  phase: DeploymentFlowPhase;
  placementId: string;
  selectedPlacementId: string;
  selections: Record<string, string>;
  hasBids: boolean;
}): PlacementSelectionState {
  if (args.phase !== "creating" && args.phase !== "quoting" && args.phase !== "deploying") return "idle";
  if (args.selections[args.placementId]) return "done";
  if (!args.hasBids) return "awaiting";
  return args.placementId === args.selectedPlacementId ? "selecting" : "idle";
}
