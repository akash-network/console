import type { FC } from "react";
import { useAtom } from "jotai";

import { useFlag } from "@src/hooks/useFlag";
import sdlStore from "@src/store/sdlStore";
import { ConfigurationPane } from "../ConfigurationPane/ConfigurationPane";
import { DeploymentPane } from "../DeploymentPane/DeploymentPane";
import { MarketplacePane } from "../MarketplacePane/MarketplacePane";
import { SdlPreviewPane } from "../SdlPreviewPane/SdlPreviewPane";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";

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

/**
 * Lays the three configure panes out as side-by-side columns at every width — Deployment and Configuration
 * on the left, the Marketplace filling the rest. On screens too narrow to fit them the whole group scrolls
 * horizontally (the parent owns the scroll container); there is no separate mobile/tabbed layout.
 */
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
  const [isSdlPreviewOpen, setIsSdlPreviewOpen] = useAtom(sdlStore.sdlPreviewOpen);
  const isSdlPreviewEnabled = d.useFlag("ui_sdl_preview_panel");
  const isLocked = phase === "creating" || phase === "quoting" || phase === "closing" || phase === "deploying";
  const isClosing = phase === "closing";

  return (
    <div className="grid h-full min-h-0 flex-1 auto-cols-fr grid-flow-col grid-cols-[auto_minmax(560px,1fr)] grid-rows-1 border-t border-zinc-300 dark:border-zinc-700">
      <div className="grid min-h-0 grid-flow-col grid-cols-[auto_360px] grid-rows-1 divide-x divide-zinc-300 dark:divide-zinc-700">
        <div className="min-h-0">
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
        <div className="min-h-0">
          <d.ConfigurationPane selectedServiceId={selectedServiceId} locked={isLocked} isClosing={isClosing} onCancelAndEdit={onCancelAndEdit} />
        </div>
      </div>
      <div className="min-h-0 border-l border-zinc-300 dark:border-zinc-700">
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
  );
};
