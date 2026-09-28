import type { FC } from "react";

import type { PlacementType } from "@src/types";
import type { ConfigurationLock } from "../ConfigurationPane/configurationLock";
import { ConfigureDeploymentBackButton } from "../ConfigureDeploymentBackButton/ConfigureDeploymentBackButton";
import { ConfigureDeploymentHeader } from "../ConfigureDeploymentHeader/ConfigureDeploymentHeader";
import { ConfigureEditor } from "../ConfigureEditor/ConfigureEditor";
import { ResetConfigurationButton } from "../ConfigureEditor/ResetConfigurationButton/ResetConfigurationButton";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { MarketplacePane } from "../MarketplacePane/MarketplacePane";
import { SdlImportExport } from "../SdlImportExport/SdlImportExport";
import { SdlPreviewPane } from "../SdlPreviewPane/SdlPreviewPane";
import { useSdlPreviewPanel } from "../SdlPreviewPane/useSdlPreviewPanel";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = {
  ConfigureDeploymentBackButton,
  ConfigureDeploymentHeader,
  ConfigureEditor,
  MarketplacePane,
  SdlImportExport,
  ResetConfigurationButton,
  SdlPreviewPane,
  useSdlPreviewPanel
};

type Props = {
  flow: DeploymentFlow;
  sdl: string;
  previewSdl: string;
  selectedServiceId: string;
  selectedPlacement: PlacementType;
  onSelectService: (serviceId: string) => void;
  onSelectProvider: (placementId: string, bidId: string) => void;
  deploymentName: string;
  typedDeploymentName: string;
  onDeploymentNameChange: (value: string) => void;
  onDeploy: () => void;
  allPlacementsHaveBids: boolean;
  onImport: (state: ImportedDeploymentState) => void;
  onReset: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureWorkspace: FC<Props> = ({
  flow,
  sdl,
  previewSdl,
  selectedServiceId,
  selectedPlacement,
  onSelectService,
  onSelectProvider,
  deploymentName,
  typedDeploymentName,
  onDeploymentNameChange,
  onDeploy,
  allPlacementsHaveBids,
  onImport,
  onReset,
  dependencies: d = DEPENDENCIES
}) => {
  const sdlPreview = d.useSdlPreviewPanel();
  const isEditable = flow.phase === "configuring" || flow.phase === "error";
  const lock = configurationLockOf(flow.phase);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-6">
        <d.ConfigureDeploymentBackButton />
        <div className="mt-2">
          <d.ConfigureDeploymentHeader
            flow={flow}
            sdl={sdl}
            deploymentName={typedDeploymentName}
            onDeploy={onDeploy}
            allPlacementsHaveBids={allPlacementsHaveBids}
          />
        </div>
      </div>
      <div className="relative mt-6 flex min-h-0 flex-1 overflow-x-auto border-t border-zinc-300 dark:border-zinc-700">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(560px,1fr)_minmax(420px,1fr)]">
          <div className="min-h-0 border-r border-zinc-300 dark:border-zinc-700">
            <d.ConfigureEditor
              selectedServiceId={selectedServiceId}
              activePlacementId={selectedPlacement.id}
              onSelectService={onSelectService}
              locked={lock}
              deploymentName={deploymentName}
              onDeploymentNameChange={onDeploymentNameChange}
              pendingClose={flow.pendingClose}
              onRetryClose={flow.actions.retryClose}
              onCancelAndEdit={flow.actions.cancelAndEdit}
              toolbar={
                <div className="flex items-center gap-1">
                  <d.SdlImportExport variant="toolbar" sdl={sdl} deploymentName={deploymentName} canImport={isEditable} onImport={onImport} />
                  <d.ResetConfigurationButton disabled={!isEditable} onReset={onReset} />
                </div>
              }
            />
          </div>
          <div className="min-h-0">
            <d.MarketplacePane
              sdl={sdl}
              placementName={selectedPlacement.name}
              region={selectedPlacement.region}
              phase={flow.phase}
              dseq={flow.dseq}
              selectedPlacementId={selectedPlacement.id}
              selectedBidId={flow.selections[selectedPlacement.id]}
              onSelectProvider={onSelectProvider}
            />
          </div>
        </div>
        {sdlPreview.isEnabled && <d.SdlPreviewPane sdl={previewSdl} isOpen={sdlPreview.isOpen} onOpen={sdlPreview.open} onClose={sdlPreview.close} />}
      </div>
    </div>
  );
};

function configurationLockOf(phase: DeploymentFlow["phase"]): ConfigurationLock | undefined {
  if (phase === "quoting") return "onchain";
  if (phase === "creating" || phase === "deploying") return "all";
  return undefined;
}
