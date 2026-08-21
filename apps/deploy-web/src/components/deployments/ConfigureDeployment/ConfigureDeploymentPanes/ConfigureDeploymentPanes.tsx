import type { FC, ReactNode } from "react";
import { useAtom } from "jotai";

import { useFlag } from "@src/hooks/useFlag";
import sdlStore from "@src/store/sdlStore";
import type { ConfigurationLock } from "../ConfigurationPane/configurationLock";
import { ConfigurationPane } from "../ConfigurationPane/ConfigurationPane";
import { DeploymentPane } from "../DeploymentPane/DeploymentPane";
import { MarketplacePane } from "../MarketplacePane/MarketplacePane";
import { PaneLockBanner } from "../PaneLockBanner/PaneLockBanner";
import { SdlPreviewPane } from "../SdlPreviewPane/SdlPreviewPane";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = { DeploymentPane, ConfigurationPane, MarketplacePane, PaneLockBanner, SdlPreviewPane, useFlag };

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
  runtimeLimitHours: number | undefined;
  onRuntimeLimitHoursChange: (value: number | undefined) => void;
  /** Rendered in the Configuration column header, e.g. the SDL import/export menu. */
  configurationActions?: ReactNode;
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
  runtimeLimitHours,
  onRuntimeLimitHoursChange,
  configurationActions,
  dependencies: d = DEPENDENCIES
}) => {
  const [isSdlPreviewOpen, setIsSdlPreviewOpen] = useAtom(sdlStore.sdlPreviewOpen);
  const isSdlPreviewEnabled = d.useFlag("ui_sdl_preview_panel");
  const isLocked = phase === "creating" || phase === "quoting" || phase === "closing" || phase === "deploying";
  const isClosing = phase === "closing";
  const configurationLock: ConfigurationLock | undefined = phase === "quoting" ? "onchain" : isLocked ? "all" : undefined;

  return (
    <div className="grid h-full min-h-0 flex-1 auto-cols-fr grid-flow-col grid-cols-[auto_minmax(560px,1fr)] grid-rows-1 border-t border-zinc-300 dark:border-zinc-700">
      <div className="grid min-h-0 grid-cols-[auto_360px] grid-rows-[auto_auto_1fr]">
        <d.DeploymentPane
          selectedServiceId={selectedServiceId}
          onSelectService={onSelectService}
          locked={isLocked}
          phase={phase}
          selections={selections}
          selectedPlacementId={selectedPlacementId}
          sdl={sdl}
          dseq={dseq}
          deploymentName={deploymentName}
          onDeploymentNameChange={onDeploymentNameChange}
          runtimeLimitHours={runtimeLimitHours}
          onRuntimeLimitHoursChange={onRuntimeLimitHoursChange}
        />
        <d.ConfigurationPane selectedServiceId={selectedServiceId} locked={configurationLock} actions={configurationActions} />
        {isLocked && (
          <div className="col-start-1 col-end-3 row-start-2">
            <d.PaneLockBanner onCancelAndEdit={onCancelAndEdit} isClosing={isClosing} />
          </div>
        )}
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
