import type { FC } from "react";
import { useState } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { useAtom } from "jotai";

import { useFlag } from "@src/hooks/useFlag";
import sdlStore from "@src/store/sdlStore";
import { ConfigurationPane } from "../ConfigurationPane/ConfigurationPane";
import { DeploymentPane } from "../DeploymentPane/DeploymentPane";
import { MarketplacePane } from "../MarketplacePane/MarketplacePane";
import { SdlPreviewPane } from "../SdlPreviewPane/SdlPreviewPane";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";

type ActivePane = "deployment" | "configuration" | "marketplace";

export const DEPENDENCIES = { DeploymentPane, ConfigurationPane, MarketplacePane, SdlPreviewPane, useFlag };

type Props = {
  sdl: string;
  previewSdl: string;
  selectedServiceId: string;
  selectedPlacementName: string;
  selectedPlacementRegion?: string;
  selectedPlacementId: string;
  onSelectService: (serviceId: string) => void;
  phase: DeploymentFlowPhase;
  dseq: string | null;
  selections: Record<string, string>;
  onSelectProvider: (placementId: string, bidId: string) => void;
  onCancelAndEdit: () => void;
  deploymentName: string;
  onDeploymentNameChange: (value: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeploymentPanes: FC<Props> = ({
  sdl,
  previewSdl,
  selectedServiceId,
  selectedPlacementName,
  selectedPlacementRegion,
  selectedPlacementId,
  onSelectService,
  phase,
  dseq,
  selections,
  onSelectProvider,
  onCancelAndEdit,
  deploymentName,
  onDeploymentNameChange,
  dependencies: d = DEPENDENCIES
}) => {
  const [activePane, setActivePane] = useState<ActivePane>("deployment");
  const [isSdlPreviewOpen, setIsSdlPreviewOpen] = useAtom(sdlStore.sdlPreviewOpen);
  const isSdlPreviewEnabled = d.useFlag("ui_sdl_preview_panel");
  const isLocked = phase === "creating" || phase === "quoting" || phase === "closing" || phase === "deploying";
  const isClosing = phase === "closing";

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid min-h-0 flex-1 grid-rows-1 md:auto-cols-fr md:grid-flow-col md:grid-cols-[auto_1fr] md:border-t md:border-zinc-300 md:dark:border-zinc-700">
        <div className="grid min-h-0 grid-rows-1 md:grid-flow-col md:grid-cols-[auto_352px] md:divide-x md:divide-zinc-300 md:dark:divide-zinc-700">
          <div className={cn("min-h-0 md:block", { hidden: activePane !== "deployment" })}>
            <d.DeploymentPane
              selectedServiceId={selectedServiceId}
              onSelectService={onSelectService}
              locked={isLocked}
              isClosing={isClosing}
              onCancelAndEdit={onCancelAndEdit}
              phase={phase}
              selections={selections}
              selectedPlacementId={selectedPlacementId}
              sdl={sdl}
              dseq={dseq}
              deploymentName={deploymentName}
              onDeploymentNameChange={onDeploymentNameChange}
            />
          </div>
          <div className={cn("min-h-0 md:block", { hidden: activePane !== "configuration" })}>
            <d.ConfigurationPane selectedServiceId={selectedServiceId} locked={isLocked} isClosing={isClosing} onCancelAndEdit={onCancelAndEdit} />
          </div>
        </div>
        <div className={cn("min-h-0 md:block md:border-l md:border-zinc-300 md:dark:border-zinc-700", { hidden: activePane !== "marketplace" })}>
          <d.MarketplacePane
            sdl={sdl}
            placementName={selectedPlacementName}
            region={selectedPlacementRegion}
            phase={phase}
            dseq={dseq}
            selectedPlacementId={selectedPlacementId}
            selectedBidId={selections[selectedPlacementId]}
            onSelectProvider={onSelectProvider}
          />
        </div>
        {isSdlPreviewEnabled && (
          <d.SdlPreviewPane sdl={previewSdl} isOpen={isSdlPreviewOpen} onOpen={() => setIsSdlPreviewOpen(true)} onClose={() => setIsSdlPreviewOpen(false)} />
        )}
      </div>

      <nav aria-label="Pane navigation" className="flex shrink-0 border-t border-zinc-300 md:hidden dark:border-zinc-700">
        <PaneTab label="1. Deployment" value="deployment" activeValue={activePane} onSelect={setActivePane} />
        <PaneTab label="2. Configuration" value="configuration" activeValue={activePane} onSelect={setActivePane} />
        <PaneTab label="3. Marketplace" value="marketplace" activeValue={activePane} onSelect={setActivePane} />
      </nav>
    </div>
  );
};

interface PaneTabProps {
  label: string;
  value: ActivePane;
  activeValue: ActivePane;
  onSelect: (value: ActivePane) => void;
}

function PaneTab({ label, value, activeValue, onSelect }: PaneTabProps) {
  const isActive = activeValue === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-current={isActive ? "page" : undefined}
      className={cn("flex-1 px-3 py-3 font-mono text-xs font-medium uppercase tracking-wide transition-colors", {
        "border-t-2 border-foreground text-foreground": isActive,
        "border-t-2 border-transparent text-muted-foreground": !isActive
      })}
    >
      {label}
    </button>
  );
}
